import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';

export const MAX_SCHOOL_LOGO_BYTES = 2 * 1024 * 1024;
const LOGO_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

export type SchoolLogoFile = {
  buffer: Buffer;
  mimetype: string;
};

@Injectable()
export class SchoolLogoStorageService {
  constructor(private readonly config: ConfigService) {}

  async upload(schoolId: string, file?: SchoolLogoFile): Promise<string> {
    const extension = this.validate(file);
    const baseUrl = this.config.getOrThrow<string>('supabase.url').replace(/\/$/, '');
    const bucket = this.config.getOrThrow<string>('supabase.schoolLogosBucket');
    const key = this.config.getOrThrow<string>('supabase.serviceRoleKey');
    const headers = { apikey: key, Authorization: `Bearer ${key}` };
    const bucketPath = encodeURIComponent(bucket);
    const bucketUrl = `${baseUrl}/storage/v1/bucket/${bucketPath}`;
    let response = await this.request(bucketUrl, { headers });

    if (!response.ok) {
      const error = (await response.json().catch(() => ({}))) as { statusCode?: string | number };
      if (response.status !== 404 && Number(error.statusCode) !== 404) {
        throw new ServiceUnavailableException('No se pudo acceder al almacenamiento de logos.');
      }
      const created = await this.request(`${baseUrl}/storage/v1/bucket`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: bucket,
          name: bucket,
          public: true,
          file_size_limit: MAX_SCHOOL_LOGO_BYTES,
          allowed_mime_types: LOGO_MIME_TYPES,
        }),
      });
      // A concurrent upload may have created the same bucket; verify its state.
      if (!created.ok && created.status !== 409 && created.status !== 400) {
        throw new ServiceUnavailableException('No se pudo preparar el almacenamiento de logos.');
      }
      response = await this.request(bucketUrl, { headers });
    }
    if (!response.ok) {
      throw new ServiceUnavailableException('No se pudo preparar el almacenamiento de logos.');
    }
    const bucketInfo = (await response.json()) as { public?: boolean };
    if (!bucketInfo.public) {
      throw new ServiceUnavailableException(
        'El almacenamiento de logos no permite mostrar imágenes en los boletines. Contacta al administrador del sistema.',
      );
    }

    const path = `${encodeURIComponent(schoolId)}/${randomUUID()}.${extension}`;
    const uploaded = await this.request(`${baseUrl}/storage/v1/object/${bucketPath}/${path}`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': file!.mimetype, 'x-upsert': 'false' },
      body: new Uint8Array(file!.buffer),
    });
    if (!uploaded.ok) {
      throw new ServiceUnavailableException('No se pudo guardar el logo. Inténtalo de nuevo.');
    }
    return `${baseUrl}/storage/v1/object/public/${bucketPath}/${path}`;
  }

  private validate(file?: SchoolLogoFile): string {
    if (!file?.buffer.length) throw new BadRequestException('Selecciona una imagen para el logo.');
    if (file.buffer.length > MAX_SCHOOL_LOGO_BYTES) {
      throw new BadRequestException('El logo no puede superar 2 MB.');
    }
    const bytes = file.buffer;
    if (
      file.mimetype === 'image/png' &&
      bytes.length >= 24 &&
      bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    )
      return 'png';
    if (
      file.mimetype === 'image/jpeg' &&
      bytes.length >= 4 &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff
    )
      return 'jpg';
    if (
      file.mimetype === 'image/webp' &&
      bytes.length >= 12 &&
      bytes.toString('ascii', 0, 4) === 'RIFF' &&
      bytes.toString('ascii', 8, 12) === 'WEBP'
    )
      return 'webp';
    throw new BadRequestException('El logo debe ser una imagen PNG, JPG o WebP válida.');
  }

  private async request(url: string, options: RequestInit): Promise<Response> {
    try {
      return await fetch(url, { ...options, signal: AbortSignal.timeout(30000) });
    } catch {
      throw new ServiceUnavailableException(
        'No se pudo conectar con el almacenamiento de logos. Inténtalo de nuevo.',
      );
    }
  }
}
