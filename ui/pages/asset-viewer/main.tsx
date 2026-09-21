import { createRoot } from 'react-dom/client';
import { App } from './App';
import { bootstrapTheme } from '../../shared/theme';
import '../../shared/page.css';
import './asset-viewer.css';

bootstrapTheme();

const container = document.getElementById('root');
if ( container !== null ) {
    createRoot(container).render(<App />);
}
