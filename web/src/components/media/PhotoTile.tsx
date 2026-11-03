// Stub for the RED commit of plan 09-08: the tile arrives with the GREEN commit.
import type { PhotoTileModel } from './photoTile.types';

export interface PhotoTileProps {
  photo: PhotoTileModel;
  position: number;
  total: number;
  mode: 'draft' | 'live' | 'readonly';
  busy: boolean;
  canDrag: boolean;
  onMove: (id: string, toIndex: number) => void;
  onMakeCover: (id: string) => void;
  onEditDescription: (id: string) => void;
  onDelete: (id: string) => void;
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
  onOpen: (id: string) => void;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onDropOn: (id: string) => void;
}

export function PhotoTile(_props: PhotoTileProps) {
  return <li />;
}
