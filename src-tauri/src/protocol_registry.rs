use std::borrow::Cow;
use std::collections::HashSet;

use tauri::http::{Request, Response};
use tauri::{Builder, Runtime};
use thiserror::Error;

pub trait SchemeHandler: Send + Sync + 'static {
    fn scheme(&self) -> &'static str;
    fn respond(&self, request: &Request<Vec<u8>>) -> Response<Vec<u8>>;
}

#[derive(Debug, Clone, PartialEq, Eq, Error)]
pub enum ProtocolRegistryError {
    #[error("the {0} scheme has more than one handler")]
    DuplicateScheme(&'static str),
}

/// Custom URL schemes, registered on the builder before the app starts.
pub struct ProtocolRegistry {
    handlers: Vec<Box<dyn SchemeHandler>>,
}

impl ProtocolRegistry {
    pub fn new(handlers: Vec<Box<dyn SchemeHandler>>) -> Result<Self, ProtocolRegistryError> {
        let mut seen = HashSet::new();
        if let Some(duplicate) = handlers
            .iter()
            .map(|handler| handler.scheme())
            .find(|scheme| !seen.insert(*scheme))
        {
            return Err(ProtocolRegistryError::DuplicateScheme(duplicate));
        }
        Ok(Self { handlers })
    }

    pub fn schemes(&self) -> Vec<&'static str> {
        self.handlers
            .iter()
            .map(|handler| handler.scheme())
            .collect()
    }

    pub fn install<R: Runtime>(self, builder: Builder<R>) -> Builder<R> {
        self.handlers.into_iter().fold(builder, |builder, handler| {
            builder.register_uri_scheme_protocol(handler.scheme(), move |_context, request| {
                handler.respond(&request).map(Cow::Owned)
            })
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    struct NamedScheme(&'static str);

    impl SchemeHandler for NamedScheme {
        fn scheme(&self) -> &'static str {
            self.0
        }

        fn respond(&self, _request: &Request<Vec<u8>>) -> Response<Vec<u8>> {
            Response::new(Vec::new())
        }
    }

    #[test]
    fn two_handlers_for_one_scheme_fail_assembly_and_name_the_scheme() {
        let result = ProtocolRegistry::new(vec![
            Box::new(NamedScheme("rustle")),
            Box::new(NamedScheme("rustle")),
        ]);

        let error = result.err().expect("duplicate rejected");
        assert_eq!(error, ProtocolRegistryError::DuplicateScheme("rustle"));
        assert!(error.to_string().contains("rustle"));
    }

    #[test]
    fn keeps_every_distinct_scheme() {
        let registry = ProtocolRegistry::new(vec![
            Box::new(NamedScheme("rustle")),
            Box::new(NamedScheme("other")),
        ])
        .expect("distinct schemes");

        assert_eq!(registry.schemes(), ["rustle", "other"]);
    }
}
