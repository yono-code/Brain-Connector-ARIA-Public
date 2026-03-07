import type { AriaNode, ContainerCanvas } from '../../../../src/shared/types';

const C4_TYPES = new Set<AriaNode['type']>([
  'c4-container',
  'c4-component',
  'c4-person',
  'c4-database',
  'c4-module',
]);

export interface AdrLinkedElementInfo {
  isC4Linked: boolean;
  elementName: string;
  locationLabel: string;
}

export function resolveAdrLinkedElementInfo(
  nodeId: string,
  rootNodes: AriaNode[],
  containerCanvases: Record<string, ContainerCanvas>,
): AdrLinkedElementInfo {
  const rootNode = rootNodes.find((n) => n.id === nodeId);
  if (rootNode) {
    return {
      isC4Linked: C4_TYPES.has(rootNode.type),
      elementName: rootNode.data.label,
      locationLabel: rootNode.data.label,
    };
  }

  for (const [containerId, canvas] of Object.entries(containerCanvases)) {
    const innerNode = canvas.nodes.find((n) => n.id === nodeId);
    if (innerNode) {
      const parentLabel = rootNodes.find((n) => n.id === containerId)?.data.label ?? containerId;
      return {
        isC4Linked: C4_TYPES.has(innerNode.type),
        elementName: innerNode.data.label,
        locationLabel: `${innerNode.data.label} (${parentLabel} 内)`,
      };
    }
  }

  return {
    isC4Linked: false,
    elementName: nodeId,
    locationLabel: nodeId,
  };
}

export function resolveAdrNodeLabel(
  nodeId: string,
  rootNodes: AriaNode[],
  containerCanvases: Record<string, ContainerCanvas>,
): string {
  return resolveAdrLinkedElementInfo(nodeId, rootNodes, containerCanvases).locationLabel;
}
