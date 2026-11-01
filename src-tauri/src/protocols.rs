use crate::protocol_registry::SchemeHandler;
use crate::vault_asset_scheme::VaultAssetScheme;

/// The single registration list for custom URL schemes.
pub fn scheme_handlers() -> Vec<Box<dyn SchemeHandler>> {
    vec![Box::new(VaultAssetScheme)]
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::protocol_registry::ProtocolRegistry;
    use crate::vault_asset_scheme::VAULT_ASSET_SCHEME;

    #[test]
    fn registers_only_the_vault_asset_scheme() {
        let registry = ProtocolRegistry::new(scheme_handlers()).expect("no duplicate schemes");

        assert_eq!(registry.schemes(), [VAULT_ASSET_SCHEME]);
    }
}
