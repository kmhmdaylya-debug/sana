import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** مسیر را از احراز هویت مستثنا می‌کند */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
