import * as React from 'react';
import Dropzone = require('react-dropzone');
import RaisedButton from 'material-ui/RaisedButton';

export interface UploadedFile {

    content: string;
}

interface FileUploadProps {
    onFiles: (files: UploadedFile[]) => void;
}

interface FileUploadState {
    status: 'ready' | 'reading';
    files: UploadedFile[];
}

export class FileUpload extends React.Component<FileUploadProps, FileUploadState> {

    constructor(props: FileUploadProps) {
        super(props);
    }

    onDrop: (files: File[]) => {

    }

    handleSubmitClick = () => {
        this.setState(state => ({...state, status: 'reading'}));
    }

    render() {
        return (
            <div>
                <Dropzone onDrop={this.onDrop}>
                    <p>Try dropping some TEI files here, or click to select files to upload.</p>
                </Dropzone>
                <RaisedButton label="Submit" primary={true} onClick={this.handleSubmitClick} />
            </div>
        );
    }
}