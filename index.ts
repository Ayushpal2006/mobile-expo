import React from 'react';
import { registerRootComponent } from 'expo';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import App from './App';
import RootErrorBoundary from './src/components/common/RootErrorBoundary';

function Root() {
  return React.createElement(
    SafeAreaProvider,
    null,
    React.createElement(RootErrorBoundary, null, React.createElement(App, null))
  );
}

// registerRootComponent calls AppRegistry.registerComponent('main', () => Root);
registerRootComponent(Root);
