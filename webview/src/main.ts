import './styles/base.css';
import './components/header/header.css';
import './features/conversations/conversations.css';
import './components/status/status.css';
import { mount } from './app/mount';

const dispose = mount();
window.addEventListener('pagehide', (event) => {
  if (!event.persisted) dispose();
});
