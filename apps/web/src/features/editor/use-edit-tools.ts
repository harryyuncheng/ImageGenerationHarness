import { useMemo, useState } from 'react';
import type { Capability } from '../../shared/types/domain.js';

export interface EditingToolSelection {
  tools: readonly Capability[];
  selectedToolId: string;
  onSelectTool: (toolId: string) => void;
}

export function useEditTools(capabilities: readonly Capability[]) {
  const [selectedEditToolId, setSelectedEditToolId] = useState('service/inpaint');
  const tools = useMemo(
    () => capabilities.filter((capability) => capability.category === 'edit'),
    [capabilities],
  );
  const selectedTool = tools.find((tool) => tool.canonicalId === selectedEditToolId) ?? tools[0];

  const selection: EditingToolSelection = {
    tools,
    selectedToolId: selectedTool?.canonicalId ?? selectedEditToolId,
    onSelectTool: (toolId: string) => {
      setSelectedEditToolId(toolId);
    },
  };

  return { selection, selectedTool };
}

export type EditToolsController = ReturnType<typeof useEditTools>;
