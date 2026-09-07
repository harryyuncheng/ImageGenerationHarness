import { SquareDashedMousePointer } from 'lucide-react';
import type { Capability } from '../../../shared/types/domain.js';
import { maskTools } from '../mask.js';
import type { AttachmentsController } from '../use-attachments.js';
import { useMaskEditor } from '../use-mask-editor.js';
import { ComposerSettingPicker, type ComposerSettingGroupProps } from './ComposerSettingPicker.js';
import { MaskEditor } from './MaskEditor.js';
import { MaskToolbar } from './MaskToolbar.js';

export function MaskChip({
  capability,
  attachments,
  image,
  settingMenu,
  onSettingMenuChange,
}: {
  capability: Capability;
  attachments: AttachmentsController;
  image: HTMLImageElement | null;
} & Pick<ComposerSettingGroupProps, 'settingMenu' | 'onSettingMenuChange'>) {
  const { source, mask } = attachments.inputs;
  const displayedImage = image?.getAttribute('src') === source?.previewUrl ? image : null;
  const editor = useMaskEditor(
    displayedImage,
    source,
    mask,
    capability,
    attachments.setMask,
    attachments.reportMaskStatus,
  );
  const open = settingMenu === 'mask' && source !== undefined;
  const label = open ? 'Mask tools' : mask ? 'Edit mask' : 'Draw mask';
  const activeTool = maskTools.find((entry) => entry.id === editor.tool) ?? maskTools[0];

  return (
    <>
      <ComposerSettingPicker
        menuId="mask-tools-menu"
        label={source ? label : 'Open an image or attach a source image to draw a mask'}
        menuLabel="Mask tools"
        value={activeTool.label}
        open={open}
        variant="mask"
        disabled={source === undefined}
        triggerContent={
          <>
            <SquareDashedMousePointer size={16} className={open || mask ? 'is-active' : ''} />
            <span className="composer-setting-value">{label}</span>
          </>
        }
        onOpenChange={(nextOpen) => {
          onSettingMenuChange('mask', nextOpen);
        }}
      >
        {() => (
          <MaskToolbar
            editor={editor}
            onUpload={() => {
              attachments.chooseFiles('mask');
            }}
          />
        )}
      </ComposerSettingPicker>
      <MaskEditor
        image={displayedImage}
        editor={editor}
        hasMask={mask !== undefined}
        toolsOpen={open}
        onOpenTools={() => {
          onSettingMenuChange('mask', true);
        }}
      />
    </>
  );
}
