import { public_app_context } from './public-app-context.js';
import { public_app_markdown } from './public-app-markdown.js';
import { public_app_presets } from './public-app-presets.js';
import { public_app_navigation } from './public-app-navigation.js';
import { public_app_modal } from './public-app-modal.js';
import { public_app_cards } from './public-app-cards.js';
import { public_app_bootstrap } from './public-app-bootstrap.js';

export const publicAppJs = '(() => {\n' +
  public_app_context +
  public_app_markdown +
  public_app_presets +
  public_app_navigation +
  public_app_modal +
  public_app_cards +
  public_app_bootstrap +
  '})();\n';
