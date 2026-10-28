import { useState } from 'react';
import { FoodPlaceholderIcon, RestaurantPlaceholderIcon } from './Icons.jsx';

// Картинка блюда/логотип заведения. Если пути нет или файл не загрузился — чистый минималистичный SVG.
export default function Thumb({ src, alt = '', className = '', fit = 'cover' }) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const showImage = Boolean(src) && !failed;
  const isLogo = fit === 'contain';

  return (
    <div className={`relative bg-paper flex items-center justify-center overflow-hidden text-muted ${className}`} aria-hidden={alt ? undefined : true}>
      {showImage ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={`w-full h-full ${isLogo ? 'object-contain p-1' : 'object-cover'}`}
        />
      ) : isLogo ? (
        <RestaurantPlaceholderIcon className="w-1/2 h-1/2 text-muted" />
      ) : (
        <FoodPlaceholderIcon className="w-1/2 h-1/2 text-muted" />
      )}
      {showImage && !loaded && <span className="absolute inset-0 animate-pulse bg-line" aria-hidden="true" />}
    </div>
  );
}
