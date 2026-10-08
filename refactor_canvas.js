const fs = require('fs');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;
const t = require('@babel/types');

const files = [
    'client/src/components/AccountsHistoryTab.jsx',
    'client/src/components/PaymentModal.jsx',
    'client/src/views/QrManagement.jsx'
];

const compressionHelper = `
const compressImage = (file, maxWidth = 800, quality = 0.7) =>
  new Promise((resolve) => {
    const img = new Image();
    img.src = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ratio = Math.min(maxWidth / img.width, 1);
      canvas.width = img.width * ratio;
      canvas.height = img.height * ratio;
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => resolve(new File([blob], file.name, { type: 'image/jpeg' })),
        'image/jpeg',
        quality
      );
    };
  });
`;

files.forEach(file => {
    if (!fs.existsSync(file)) {
        console.error("File not found:", file);
        return;
    }
    let code = fs.readFileSync(file, 'utf-8');
    
    // Quick inject helper if not exists
    if (!code.includes('const compressImage =')) {
        // inject after imports
        code = code.replace(/(import .*;\n)+/, (match) => match + '\n' + compressionHelper + '\n');
    }
    
    // Replace handleFileChange logic using regex to avoid Babel complexity with JSX and hooks formatting
    // PaymentModal & AccountsHistoryTab:
    code = code.replace(
        /const (localHandleFileChange|handleFileChange) = \(e\) => \{\s*if \(e\.target\.files\) \{\s*setEvidenceFiles\(prev => \[\.\.\.prev, \.\.\.Array\.from\(e\.target\.files\)\]\);\s*\}\s*\};/g,
        `const $1 = async (e) => {
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
            setEvidenceFiles(prev => [...prev, ...compressedFiles]);
        }
    };`
    );

    // QrManagement.jsx might have different state setter, e.g. setFormData
    code = code.replace(
        /const (handleFileChange|handleLogoChange) = \(e\) => \{\s*if \(e\.target\.files\) \{\s*setFormData\(prev => \(\{ \.\.\.prev, [a-zA-Z]+: e\.target\.files\[0\] \}\)\);\s*\}\s*\};/g,
        `const $1 = async (e) => {
        if (e.target.files && e.target.files.length > 0) {
            let file = e.target.files[0];
            if (file.type.startsWith('image/')) {
                file = await compressImage(file);
            }
            setFormData(prev => ({ ...prev, logo: file }));
        }
    };`
    );

    fs.writeFileSync(file, code, 'utf-8');
    console.log(`Updated ${file}`);
});
