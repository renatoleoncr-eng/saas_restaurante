export const compressImage = (file, maxWidth = 800, quality = 0.7) =>
  new Promise((resolve) => {
    try {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const ratio = Math.min(maxWidth / img.width, 1);
          canvas.width = img.width * ratio;
          canvas.height = img.height * ratio;
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(new File([blob], file.name, { type: 'image/jpeg' }));
              } else {
                resolve(file); // Fallback if canvas fails
              }
            },
            'image/jpeg',
            quality
          );
        } catch (e) {
          resolve(file);
        }
      };
      img.onerror = () => {
        resolve(file);
      };
      img.src = URL.createObjectURL(file);
    } catch (e) {
      resolve(file);
    }
  });
