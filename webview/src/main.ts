import { mount } from './view.js';

const dispose = mount();
window.addEventListener('pagehide', event => { if (!event.persisted) dispose(); });
