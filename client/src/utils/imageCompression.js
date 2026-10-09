export const compressImage = (file, maxWidth = 800, quality = 0.7) =>
  new Promise((resolve) => {
    // Failsafe timeout: if compression hangs for more than 2.5s, return original file
    const timer = setTimeout(() => {
      resolve(file);
    }, 2500);

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
              clearTimeout(timer);
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
          clearTimeout(timer);
          resolve(file);
        }
      };
      img.onerror = () => {
        clearTimeout(timer);
        resolve(file);
      };
      img.src = URL.createObjectURL(file);
    } catch (e) {
      clearTimeout(timer);
      resolve(file);
    }
  });
