import { Transform } from 'class-transformer';
import { IsString, MinLength } from 'class-validator';
import { IsUserEmail } from '../../common/decorators/is-user-email.decorator';

export class LoginDto {
  @IsUserEmail()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  email: string;

  @IsString()
  @MinLength(1)
  password: string;
}
