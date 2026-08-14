import type { Notify } from '../../shared/hooks/use-toasts.js';
import type { ReferenceImage } from '../../shared/types/domain.js';
import type { AttachmentsController } from './use-attachments.js';
import type { GenerationSettingsController } from './use-generation-settings.js';

interface ReferenceAttachmentOptions {
  attachments: AttachmentsController;
  settings: GenerationSettingsController;
  notify: Notify;
  onAttached: () => void;
}

/**
 * Attaches a saved reference image to the composer. Core is text-only, so a
 * reference switches the studio to the closest image-capable model.
 */
export function useReferenceAttachment({
  attachments,
  settings,
  notify,
  onAttached,
}: ReferenceAttachmentOptions) {
  return function attachReferenceImage(image: ReferenceImage) {
    if (attachments.hasLibraryImage(image.imageId)) {
      notify('That reference is already attached.');
      onAttached();
      return;
    }
    if (attachments.isFull) {
      notify('A prompt can contain up to four images.', 'error');
      return;
    }
    attachments.addLibraryImage(image);
    if (settings.selectedCapability.canonicalId === 'generation/core') {
      settings.updateSettings('targetId', 'generation/sd3.5-large');
    }
    onAttached();
    notify('Reference image attached.', 'success');
  };
}
