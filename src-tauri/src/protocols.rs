use rustle_infrastructure::{FileSystemImageAssetRepository, ResolvedVaultScope};

use crate::protocol_registry::SchemeHandler;
use crate::vault_asset_scheme::VaultAssetScheme;

/// The single registration list for custom URL schemes.
pub fn scheme_handlers(vault: &ResolvedVaultScope) -> Vec<Box<dyn SchemeHandler>> {
    vec![Box::new(VaultAssetScheme::new(
        FileSystemImageAssetRepository::in_vault(vault.clone()),
    ))]
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::protocol_registry::ProtocolRegistry;
    use crate::vault_asset_scheme::VAULT_ASSET_SCHEME;
    use rustle_domain::VaultScope;

    #[test]
    fn registers_only_the_vault_asset_scheme() {
        let vault = ResolvedVaultScope::new(VaultScope::new("/Users/james/Rustle"));
        let registry =
            ProtocolRegistry::new(scheme_handlers(&vault)).expect("no duplicate schemes");

        assert_eq!(registry.schemes(), [VAULT_ASSET_SCHEME]);
    }
}
