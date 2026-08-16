import { CanvasEditor, type CanvasEditorProps } from './CanvasEditor.js';
import { CanvasViews, type CanvasViewsProps } from './CanvasViews.js';
import { MobileNav } from './MobileNav.js';
import { TopBar } from './TopBar.js';

type StudioMainProps = CanvasViewsProps &
  Pick<CanvasEditorProps, 'describeDestination' | 'onViewMetadata'>;

/** The primary column: top bar, mobile navigation, and the canvas region. */
export function StudioMain({ describeDestination, onViewMetadata, ...canvas }: StudioMainProps) {
  const { navigation, repository } = canvas;

  return (
    <div className={`studio-main ${navigation.showCreateWorkspace ? 'studio-main--create' : ''}`}>
      <TopBar navigation={navigation} repository={repository} />

      {navigation.mobileNavOpen && (
        <MobileNav
          isActiveView={navigation.showsView}
          onSelectView={(view) => {
            navigation.selectStudioView(view);
            navigation.setMobileNavOpen(false);
          }}
        />
      )}

      <div className="workspace">
        <main className="canvas">
          <CanvasEditor
            editor={canvas.editor}
            capabilities={canvas.capabilities}
            runs={canvas.runs}
            editSource={canvas.editSource}
            draftActions={canvas.draftActions}
            describeDestination={describeDestination}
            onViewMetadata={onViewMetadata}
          />
          <CanvasViews {...canvas} />
        </main>
      </div>

      {!navigation.showsView('gallery') && (
        <button
          type="button"
          className="gallery-launcher surface-enter"
          aria-label="View your past creations here"
          onClick={() => {
            navigation.selectStudioView('gallery');
          }}
        >
          View your past creations here
        </button>
      )}
    </div>
  );
}
