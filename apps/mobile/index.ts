import { registerRootComponent } from 'expo';

import { App } from './src/app/App';

// Registra o componente raiz tanto no Expo Go quanto num build nativo.
registerRootComponent(App);
