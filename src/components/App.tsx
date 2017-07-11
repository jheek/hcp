import * as React from 'react';

import {FileUpload, UploadedFile} from './FileUpload';
import {FilesList, Files} from './Files';
import MuiThemeProvider from 'material-ui/styles/MuiThemeProvider';
import * as fetch from 'isomorphic-fetch';



interface AppState {
    step: 'file-upload';
    files: Files;
}

export class App extends React.Component<{}, AppState> {

    constructor() {
        super();
        this.state = {
            step: 'file-upload',
            files: {files: [], inProgress: {}}
        }
    }
    
    componentDidMount() {
        setInterval(() => {
            fetch('/api/files')
                .then(res => res.json())
                .then(files => {
                    console.log(files);
                    this.setState(state => ({...state, files}));
                })
                .catch(console.error);
        }, 500);
    }

    handleFiles = (files: UploadedFile[]) => {
        console.log(files);
        fetch('/api/transform', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({files})
        }).then(res => res.json())
          .then(json => console.log(json))
          .catch(err => console.error(err));
    }

    render() {
        return (
            <MuiThemeProvider>
                <div>
                    <FileUpload onFiles={this.handleFiles} />
                    <FilesList files={this.state.files} />
                </div>
            </MuiThemeProvider>
        );
    }
}