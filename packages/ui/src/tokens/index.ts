// @redex/ui token layer — the single source of truth for the Redex Academy look.
// Components/screens consume tokens via Tailwind classes (mapped to CSS variables
// in ../styles/tokens.css); these TS exports are for code that needs a literal +
// the token-snapshot test. Raw color hex is permitted ONLY here + in tokens.css.
export { colors, DOMAIN_COLOR, type ColorToken } from './colors';
export { typography } from './typography';
export { layout } from './layout';
export { motion } from './motion';
