import * as React from 'react';

import * as injectTapEventPlugin from 'react-tap-event-plugin';

// Needed for onTouchTap
// http://stackoverflow.com/a/34015469/988941
injectTapEventPlugin();

import {FileUpload, UploadedFile} from './FileUpload';
import MuiThemeProvider from 'material-ui/styles/MuiThemeProvider';

interface AppState {
    step: 'file-upload';

}

export class App extends React.Component<{}, AppState> {

    constructor() {
        super();
    }

    handleFiles = (files: UploadedFile[]) => {

    }

    render() {
        return (
            <MuiThemeProvider>
                <div>
                    <FileUpload onFiles={this.handleFiles}/>
                </div>
            </MuiThemeProvider>
        );
    }
}