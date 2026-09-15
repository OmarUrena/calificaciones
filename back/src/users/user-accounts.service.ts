import {
  BadRequestException,
  ConflictException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type AuthAccount = { id: string; email?: string };

@Injectable()
export class UserAccountsService {
  constructor(private readonly config: ConfigService) {}

  async create(email: string, password: string, fullName: string): Promise<string> {
    const result = await this.request('', 'POST', {
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    const account = result as AuthAccount;
    if (!account.id)
      throw new ServiceUnavailableException(
        'No se pudo confirmar la creación de la cuenta de acceso.',
      );
    return account.id;
  }

  async removeCreatedAccount(id: string): Promise<void> {
    await this.request(`/${encodeURIComponent(id)}`, 'DELETE', { should_soft_delete: false });
  }

  async find(id: string, email: string): Promise<string> {
    const direct = (await this.request(
      `/${encodeURIComponent(id)}`,
      'GET',
      undefined,
      true,
    )) as AuthAccount | null;
    if (direct?.id) return direct.id;
    // Legacy internal users may have a different ID from their Supabase account.
    for (let page = 1; ; page += 1) {
      const result = (await this.request(`?page=${page}&per_page=100`, 'GET')) as {
        users: AuthAccount[];
      };
      const found = result.users.find(
        (account) => account.email?.toLowerCase() === email.toLowerCase(),
      );
      if (found) return found.id;
      if (result.users.length < 100) break;
    }
    throw new BadRequestException(
      'No se encontró la cuenta de acceso de este usuario para cambiar su correo.',
    );
  }

  async updateEmail(id: string, email: string): Promise<void> {
    await this.request(`/${encodeURIComponent(id)}`, 'PUT', { email, email_confirm: true });
  }

  private async request(
    path: string,
    method: string,
    body?: object,
    allowMissing = false,
  ): Promise<unknown> {
    const base = this.config.getOrThrow<string>('supabase.url').replace(/\/$/, '');
    const key = this.config.getOrThrow<string>('supabase.serviceRoleKey');
    let response: Response;
    try {
      response = await fetch(`${base}/auth/v1/admin/users${path}`, {
        method,
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(30000),
      });
    } catch {
      throw new ServiceUnavailableException(
        'No se pudo conectar con el servicio de cuentas. Revisa si el usuario se creó antes de reintentar.',
      );
    }
    if (allowMissing && response.status === 404) return null;
    const data = (await response.json().catch(() => ({}))) as {
      code?: string;
      error_code?: string;
      msg?: string;
    };
    if (!response.ok) {
      const code = data.code ?? data.error_code;
      if (code === 'email_exists' || code === 'user_already_exists' || response.status === 409) {
        throw new ConflictException('Ya existe una cuenta con ese correo electrónico.');
      }
      if (response.status === 422 || response.status === 400) {
        throw new BadRequestException(
          'No se pudo guardar la cuenta. Revisa el correo y que la contraseña cumpla los requisitos de acceso.',
        );
      }
      throw new ServiceUnavailableException(
        'No se pudo guardar la cuenta de acceso. Inténtalo de nuevo.',
      );
    }
    return data;
  }
}
