import { ChevronUp } from 'lucide-react';
import type { Capability, ProviderDescriptor } from '../../../shared/types/domain.js';
import { capabilityDescription } from '../capabilities.js';
import { ComposerSettingOptions, ComposerSettingPicker } from './ComposerSettingPicker.js';

export function ToolbarModelPicker({
  capabilities,
  providers,
  selectedCapability,
  open,
  onOpenChange,
  onSelect,
}: {
  capabilities: readonly Capability[];
  providers: readonly ProviderDescriptor[];
  selectedCapability: Capability;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (targetId: string) => void;
}) {
  const options = providers.flatMap((provider) =>
    capabilities
      .filter((capability) => capability.providerId === provider.providerId)
      .map((capability) => ({
        value: capability.canonicalId,
        label: capability.name,
        description: `${provider.name} - ${
          provider.configured ? capabilityDescription(capability) : provider.setupHint
        }`,
        disabled: !provider.configured,
      })),
  );

  return (
    <div className="toolbar-model-picker">
      <ComposerSettingPicker
        menuId="image-model-menu"
        label="Model"
        menuLabel="Image model"
        menuDescription="Choose a model for this workflow"
        value={selectedCapability.name}
        open={open}
        variant="model"
        triggerContent={
          <>
            <span className="composer-setting-value">{selectedCapability.name}</span>
            <ChevronUp size={14} aria-hidden="true" />
          </>
        }
        onOpenChange={onOpenChange}
      >
        {(close) => (
          <ComposerSettingOptions
            label="Models"
            variant="model"
            value={selectedCapability.canonicalId}
            options={options}
            onSelect={(targetId) => {
              onSelect(targetId);
              close();
            }}
          />
        )}
      </ComposerSettingPicker>
    </div>
  );
}
