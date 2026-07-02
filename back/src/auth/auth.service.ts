import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';

type SupabaseAuthUser = {
  id?: string;
  email?: string;
  user_metadata?: {
    email?: string;
    full_name?: string;
    name?: string;
  };
};

@Injectable()
export class AuthService {
  private readonly supabaseUrl: string;
  private readonly supabaseAnonKey: string;

  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.supabaseUrl = configService.getOrThrow<string>('supabase.url');
    this.supabaseAnonKey = configService.getOrThrow<string>('supabase.anonKey');
  }

  getLoginInstructions(): { message: string } {
    return {
      message:
        'Authenticate with Supabase Auth on the client and send the access token as a Bearer token.',
    };
  }

  async validateBearerToken(token: string): Promise<AuthenticatedUser> {
    const authUser = await this.getSupabaseUser(token);
    const user = await this.findInternalUser(authUser);

    if (!user?.isActive) {
      throw new UnauthorizedException('User is not active or does not exist.');
    }

    const activeSchoolYear = user.schoolId
      ? await this.prisma.schoolYear.findFirst({
          where: { schoolId: user.schoolId, isActive: true },
          select: { id: true, name: true },
        })
      : null;

    return {
      id: user.id,
      schoolId: user.schoolId,
      teacherId: user.teacherId,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      isActive: user.isActive,
      school: user.school,
      activeSchoolYear,
    };
  }

  private async getSupabaseUser(token: string): Promise<SupabaseAuthUser> {
    const url = new URL('/auth/v1/user', this.supabaseUrl);

    try {
      const response = await fetch(url, {
        headers: {
          apikey: this.supabaseAnonKey,
          authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new UnauthorizedException('Invalid or expired token.');
      }

      return (await response.json()) as SupabaseAuthUser;
    } catch {
      throw new UnauthorizedException('Invalid or expired token.');
    }
  }

  private async findInternalUser(authUser: SupabaseAuthUser) {
    const email = authUser.email ?? authUser.user_metadata?.email;

    if (!authUser.id && !email) {
      throw new UnauthorizedException('Token does not include a supported user identifier.');
    }

    return this.prisma.user.findFirst({
      where: {
        OR: [...(authUser.id ? [{ id: authUser.id }] : []), ...(email ? [{ email }] : [])],
      },
      include: {
        school: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }
}
