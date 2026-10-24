import { IsString, MinLength } from 'class-validator';

export class DeleteSchoolDto {
  @IsString()
  @MinLength(1, { message: 'La contraseña es obligatoria.' })
  password: string;
}
