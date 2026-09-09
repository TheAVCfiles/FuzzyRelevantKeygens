// Optional scene metadata for Replit workspace integrations. When the
// workspace's scene controls are enabled for this project, a viewer's click on
// a scene segment scopes their next chat request to that scene's source file.
// Fill one entry per SCENE_DURATIONS key in VideoTemplate.tsx only when a
// skill reference asks for it; otherwise leave the map empty. Scenes missing
// from the map still play and can be jumped to.
//
// Example:
//   export const SCENE_DETAILS: Record<string, SceneDetails> = {
//     open: { title: 'Intro', filePath: 'src/components/video/video_scenes/Scene1.tsx' },
//   };

export interface SceneDetails {
  title: string;
  filePath: string;
}

export const SCENE_DETAILS: Record<string, SceneDetails> = {
  scene1: { title: 'The signature that writes itself', filePath: 'src/components/video/video_scenes/Scene1.tsx' },
  scene2: { title: 'Orchestrated intelligence', filePath: 'src/components/video/video_scenes/Scene2.tsx' },
  scene3: { title: 'Grounded podcast desk', filePath: 'src/components/video/video_scenes/Scene3.tsx' },
  scene4: { title: 'Human approval', filePath: 'src/components/video/video_scenes/Scene4.tsx' },
  scene5: { title: 'Generative audio', filePath: 'src/components/video/video_scenes/Scene5.tsx' },
  scene6: { title: 'Public Cut Key', filePath: 'src/components/video/video_scenes/Scene6.tsx' },
  scene7: { title: 'Autography', filePath: 'src/components/video/video_scenes/Scene7.tsx' },
};
