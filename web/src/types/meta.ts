export interface PlatformOption {
  id: string;
  name: string;
  upstream_model: string;
}

export interface CameraMoveOption {
  id: string;
  cn: string;
  en: string;
  needsDir: boolean;
}

export interface MetaOptions {
  styles: string[];
  tags: string[];
  camera_moves: {
    basic: CameraMoveOption[];
    advanced: CameraMoveOption[];
    special: CameraMoveOption[];
  };
  speed_options: string[];
  magnitude_options: string[];
  direction_options: string[];
  platforms: PlatformOption[];
  resolutions: string[];
  video_lengths: number[];
}
