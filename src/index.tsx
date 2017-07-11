import * as React from "react";
import * as ReactDOM from "react-dom";
import * as injectTapEventPlugin from 'react-tap-event-plugin';

// Needed for onTouchTap
// http://stackoverflow.com/a/34015469/988941
injectTapEventPlugin();

import {App} from './components/App';


ReactDOM.render(
    <App />,
    document.getElementById("app")
);