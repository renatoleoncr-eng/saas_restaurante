const fs = require('fs');

const file = 'client/src/views/QrManagement.jsx';
let code = fs.readFileSync(file, 'utf-8');

code = code.replace(
    /onChange=\{\(e\) => setQrFormData\(prev => \(\{ \.\.\.prev, imageFile: e\.target\.files\[0\] \}\)\)\}/g,
    `onChange={async (e) => {
        if (e.target.files && e.target.files.length > 0) {
            let file = e.target.files[0];
            if (file.type.startsWith('image/')) {
                file = await compressImage(file);
            }
            setQrFormData(prev => ({ ...prev, imageFile: file }));
        }
    }}`
);

code = code.replace(
    /onChange=\{\(e\) => setSlideFormData\(prev => \(\{ \.\.\.prev, imageFiles: e\.target\.files \}\)\)\}/g,
    `onChange={async (e) => {
        if (e.target.files) {
            const filesArray = Array.from(e.target.files);
            const compressedFiles = await Promise.all(
                filesArray.map(file => {
                    if (file.type.startsWith('image/')) {
                        return compressImage(file);
                    }
                    return file;
                })
            );
            setSlideFormData(prev => ({ ...prev, imageFiles: compressedFiles }));
        }
    }}`
);

fs.writeFileSync(file, code, 'utf-8');
console.log('Fixed QrManagement');
