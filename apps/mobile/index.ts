import { registerRootComponent } from "expo";
import App from "./src/App";

// Registering explicitly keeps the app runnable in Expo Go, a development
// build, and a signed Android release without a router-specific entry point.
registerRootComponent(App);
