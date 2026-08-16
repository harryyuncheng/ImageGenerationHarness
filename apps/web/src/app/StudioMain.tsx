import { Bookmark, FolderOpen } from 'lucide-react';
import { CanvasEditor, type CanvasEditorProps } from './CanvasEditor.js';
import { CanvasViews, type CanvasViewsProps } from './CanvasViews.js';
import { TopBar } from './TopBar.js';

type StudioMainProps = CanvasViewsProps &
  Pick<CanvasEditorProps, 'describeDestination' | 'onViewMetadata'>;

export function StudioMain({ describeDestination, onViewMetadata, ...canvas }: StudioMainProps) {
  const { navigation, repository } = canvas;

  return (
    <div className={`studio-main ${navigation.showCreateWorkspace ? 'studio-main--create' : ''}`}>
      <TopBar navigation={navigation} repository={repository} />

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

      <nav className="library-shortcuts" aria-label="Library shortcuts">
        <button
          type="button"
          className={`icon-button studio-corner-icon ${navigation.showsView('references') ? 'active' : ''}`}
          aria-label="Reference library"
          aria-pressed={navigation.showsView('references')}
          title="Reference library"
          onClick={() => {
            navigation.selectStudioView('references');
          }}
        >
          <FolderOpen size={18} />
        </button>
        <button
          type="button"
          className={`icon-button studio-corner-icon ${navigation.showsView('presets') ? 'active' : ''}`}
          aria-label="Saved presets"
          aria-pressed={navigation.showsView('presets')}
          title="Saved presets"
          onClick={() => {
            navigation.selectStudioView('presets');
          }}
        >
          <Bookmark size={18} />
        </button>
      </nav>

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
