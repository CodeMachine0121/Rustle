use std::collections::HashMap;

use tauri::Runtime;
use tauri::ipc::Invoke;
use thiserror::Error;

use crate::channel::Channel;
use crate::command_error::CommandError;

#[derive(Debug, Clone, PartialEq, Eq, Error)]
pub enum ChannelRegistryError {
    #[error("the {0} channel has more than one handler")]
    DuplicateHandler(Channel),
    #[error("channels without a handler: {}", .0.iter().map(|channel| channel.name()).collect::<Vec<_>>().join(", "))]
    MissingHandlers(Vec<Channel>),
    #[error("no channel answers '{0}'")]
    UnknownChannel(String),
}

type InvokeHandler<R> = Box<dyn Fn(Invoke<R>) -> bool + Send + Sync>;

pub struct ChannelHandler<R: Runtime> {
    channel: Channel,
    invoke: InvokeHandler<R>,
}

impl<R: Runtime> ChannelHandler<R> {
    pub fn new(
        channel: Channel,
        invoke: impl Fn(Invoke<R>) -> bool + Send + Sync + 'static,
    ) -> Self {
        Self {
            channel,
            invoke: Box::new(invoke),
        }
    }

    pub fn channel(&self) -> Channel {
        self.channel
    }
}

/// One handler per channel, checked complete and unique when assembled.
pub struct ChannelRegistry<R: Runtime> {
    handlers: HashMap<Channel, ChannelHandler<R>>,
}

impl<R: Runtime> ChannelRegistry<R> {
    pub fn new(
        handlers: impl IntoIterator<Item = ChannelHandler<R>>,
    ) -> Result<Self, ChannelRegistryError> {
        let mut by_channel = HashMap::new();
        for handler in handlers {
            let channel = handler.channel();
            if by_channel.insert(channel, handler).is_some() {
                return Err(ChannelRegistryError::DuplicateHandler(channel));
            }
        }
        let missing: Vec<Channel> = Channel::ALL
            .iter()
            .copied()
            .filter(|channel| !by_channel.contains_key(channel))
            .collect();
        if !missing.is_empty() {
            return Err(ChannelRegistryError::MissingHandlers(missing));
        }
        Ok(Self {
            handlers: by_channel,
        })
    }

    pub fn handler_named(
        &self,
        command_name: &str,
    ) -> Result<&ChannelHandler<R>, ChannelRegistryError> {
        Channel::from_command_name(command_name)
            .and_then(|channel| self.handlers.get(&channel))
            .ok_or_else(|| ChannelRegistryError::UnknownChannel(command_name.to_owned()))
    }

    /// The app's only invoke handler: names outside the registry are
    /// rejected with an `unknownChannel` failure.
    pub fn into_invoke_handler(self) -> impl Fn(Invoke<R>) -> bool + Send + Sync + 'static {
        move |invoke| {
            let command_name = invoke.message.command().to_owned();
            match self.handler_named(&command_name) {
                Ok(handler) => (handler.invoke)(invoke),
                Err(_) => {
                    invoke
                        .resolver
                        .reject(CommandError::unknown_channel(&command_name));
                    true
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tauri::test::MockRuntime;

    fn handler(channel: Channel) -> ChannelHandler<MockRuntime> {
        ChannelHandler::new(channel, |_invoke| true)
    }

    fn one_handler_per_channel() -> Vec<ChannelHandler<MockRuntime>> {
        Channel::ALL.iter().copied().map(handler).collect()
    }

    #[test]
    fn every_declared_channel_has_a_handler() {
        let registry = ChannelRegistry::new(one_handler_per_channel()).expect("complete registry");

        for channel in Channel::ALL {
            assert!(registry.handler_named(channel.command_name()).is_ok());
        }
    }

    #[test]
    fn each_handler_answers_only_its_own_channel() {
        let registry = ChannelRegistry::new(one_handler_per_channel()).expect("complete registry");

        for channel in Channel::ALL {
            let handler = registry
                .handler_named(channel.command_name())
                .expect("registered");
            assert_eq!(handler.channel(), *channel);
        }
    }

    #[test]
    fn an_unknown_name_is_an_error_not_an_empty_answer() {
        let registry = ChannelRegistry::new(one_handler_per_channel()).expect("complete registry");

        assert_eq!(
            registry.handler_named("format_disk").err(),
            Some(ChannelRegistryError::UnknownChannel(
                "format_disk".to_owned()
            ))
        );
    }

    #[test]
    fn two_handlers_for_one_channel_fail_assembly_and_name_the_channel() {
        let mut handlers = one_handler_per_channel();
        handlers.push(handler(Channel::SaveBody));

        let error = ChannelRegistry::new(handlers)
            .err()
            .expect("duplicate rejected");

        assert_eq!(
            error,
            ChannelRegistryError::DuplicateHandler(Channel::SaveBody)
        );
        assert!(error.to_string().contains("saveBody"));
    }

    #[test]
    fn a_channel_without_a_handler_fails_assembly_and_is_named() {
        let handlers = one_handler_per_channel()
            .into_iter()
            .filter(|handler| handler.channel() != Channel::ReadSettings);

        let error = ChannelRegistry::new(handlers)
            .err()
            .expect("incomplete rejected");

        assert_eq!(
            error,
            ChannelRegistryError::MissingHandlers(vec![Channel::ReadSettings])
        );
        assert!(error.to_string().contains("readSettings"));
    }
}
