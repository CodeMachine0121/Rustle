/// The vault asset scheme as macOS/Linux (`rustle:`) and Windows
/// (`http://rustle.localhost`) webviews spell it.
const VAULT_ASSET_SOURCES: [&str; 2] = ["rustle:", "http://rustle.localhost"];
const DEV_SERVER_SOURCES: [&str; 2] = ["ws://localhost:1420", "http://localhost:1420"];

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ContentSecurityPolicy {
    directives: Vec<(&'static str, Vec<&'static str>)>,
}

impl ContentSecurityPolicy {
    pub fn production() -> Self {
        let mut image_sources = vec!["'self'", "data:"];
        image_sources.extend(VAULT_ASSET_SOURCES);
        Self {
            directives: vec![
                ("default-src", vec!["'none'"]),
                ("script-src", vec!["'self'"]),
                // CodeMirror injects its theme as runtime <style> elements.
                ("style-src", vec!["'self'", "'unsafe-inline'"]),
                ("img-src", image_sources),
                ("font-src", vec!["'self'", "data:"]),
                // Tauri falls back from its fetch-based IPC to postMessage
                // when this blocks it, so channels keep working fully offline.
                ("connect-src", vec!["'none'"]),
                ("object-src", vec!["'none'"]),
                ("base-uri", vec!["'none'"]),
                ("form-action", vec!["'none'"]),
                ("frame-ancestors", vec!["'none'"]),
            ],
        }
    }

    pub fn development() -> Self {
        let mut policy = Self::production();
        policy.allow("connect-src", &DEV_SERVER_SOURCES);
        policy
    }

    pub fn to_header_value(&self) -> String {
        self.directives
            .iter()
            .map(|(directive, sources)| format!("{directive} {}", sources.join(" ")))
            .collect::<Vec<_>>()
            .join("; ")
    }

    fn allow(&mut self, directive: &str, extra_sources: &[&'static str]) {
        if let Some((_, sources)) = self
            .directives
            .iter_mut()
            .find(|(name, _)| *name == directive)
        {
            sources.retain(|source| *source != "'none'");
            sources.extend_from_slice(extra_sources);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    fn directives(policy: &ContentSecurityPolicy) -> HashMap<String, Vec<String>> {
        policy
            .to_header_value()
            .split(';')
            .map(|directive| {
                let mut words = directive.split_whitespace().map(str::to_owned);
                let name = words.next().expect("directive has a name");
                (name, words.collect())
            })
            .collect()
    }

    fn sources<'a>(directives: &'a HashMap<String, Vec<String>>, name: &str) -> &'a [String] {
        directives.get(name).map(Vec::as_slice).unwrap_or_default()
    }

    #[test]
    fn production_denies_everything_by_default_and_never_reaches_the_network() {
        let production = directives(&ContentSecurityPolicy::production());

        assert_eq!(sources(&production, "default-src"), ["'none'"]);
        assert_eq!(sources(&production, "script-src"), ["'self'"]);
        assert_eq!(sources(&production, "object-src"), ["'none'"]);
        assert_eq!(sources(&production, "base-uri"), ["'none'"]);
        assert_eq!(sources(&production, "form-action"), ["'none'"]);
        assert_eq!(sources(&production, "connect-src"), ["'none'"]);
    }

    #[test]
    fn production_loads_images_only_from_the_app_inline_data_and_the_vault() {
        let production = directives(&ContentSecurityPolicy::production());

        assert_eq!(
            sources(&production, "img-src"),
            ["'self'", "data:", "rustle:", "http://rustle.localhost"]
        );
    }

    #[test]
    fn no_custom_scheme_is_reachable_through_fetch() {
        let production = directives(&ContentSecurityPolicy::production());

        assert!(
            !sources(&production, "connect-src")
                .iter()
                .any(|source| source.starts_with("rustle"))
        );
    }

    #[test]
    fn development_adds_only_the_local_dev_server_connection() {
        let production = directives(&ContentSecurityPolicy::production());
        let development = directives(&ContentSecurityPolicy::development());

        assert_eq!(
            sources(&development, "connect-src"),
            ["ws://localhost:1420", "http://localhost:1420"]
        );
        for (directive, production_sources) in &production {
            if directive != "connect-src" {
                assert_eq!(
                    sources(&development, directive),
                    production_sources.as_slice()
                );
            }
        }
    }

    #[test]
    fn no_policy_allows_arbitrary_sources() {
        for policy in [
            ContentSecurityPolicy::production(),
            ContentSecurityPolicy::development(),
        ] {
            assert!(
                directives(&policy)
                    .values()
                    .flatten()
                    .all(|source| source != "*" && source != "https:" && source != "http:")
            );
        }
    }

    #[test]
    fn renders_as_one_semicolon_separated_header_value() {
        let header = ContentSecurityPolicy::production().to_header_value();

        assert!(header.starts_with("default-src 'none'; script-src 'self'; "));
        assert!(!header.contains('\n'));
    }

    #[test]
    fn tauri_configuration_uses_exactly_these_policies() {
        let configuration: serde_json::Value =
            serde_json::from_str(include_str!("../tauri.conf.json"))
                .expect("valid tauri.conf.json");
        let security = &configuration["app"]["security"];

        assert_eq!(
            security["csp"],
            ContentSecurityPolicy::production().to_header_value()
        );
        assert_eq!(
            security["devCsp"],
            ContentSecurityPolicy::development().to_header_value()
        );
        assert_eq!(
            security["dangerousDisableAssetCspModification"],
            serde_json::json!(["style-src"])
        );
    }
}
