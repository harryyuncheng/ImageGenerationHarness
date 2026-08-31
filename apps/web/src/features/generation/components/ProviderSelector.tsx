import { Check } from 'lucide-react';
import type { ProviderDescriptor, ProviderId } from '../../../shared/types/domain.js';

/** An unconfigured provider stays visible so its setup requirement is discoverable. */
export function ProviderSelector({
  providers,
  activeProviderId,
  onSelect,
}: {
  providers: readonly ProviderDescriptor[];
  activeProviderId: ProviderId;
  onSelect: (providerId: ProviderId) => void;
}) {
  return (
    <div className="provider-selector" role="radiogroup" aria-label="Image provider">
      {providers.map((provider) => {
        const selected = provider.providerId === activeProviderId;
        return (
          <button
            type="button"
            key={provider.providerId}
            className={`provider-option ${selected ? 'selected' : ''}`}
            role="radio"
            aria-checked={selected}
            disabled={!provider.configured}
            onClick={() => {
              onSelect(provider.providerId);
            }}
          >
            <span className="provider-option__copy">
              <strong>{provider.name}</strong>
              <small>{provider.description}</small>
              {!provider.configured && (
                <small className="provider-option__hint">{provider.setupHint}</small>
              )}
            </span>
            {selected && <Check size={15} aria-hidden="true" />}
          </button>
        );
      })}
    </div>
  );
}
