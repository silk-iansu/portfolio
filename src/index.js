import initScrollReveal from "./scripts/scrollReveal";
import initTiltEffect from "./scripts/tiltAnimation";
import initThemeToggle from "./scripts/themeToggle";
import initNowPlaying from "./scripts/nowPlaying";
import { targetElements, defaultProps } from "./data/scrollRevealConfig";

initScrollReveal(targetElements, defaultProps);
initTiltEffect();
initThemeToggle();
initNowPlaying();
