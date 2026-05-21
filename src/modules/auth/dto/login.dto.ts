import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class LoginDto {
  @ApiProperty({ example: 'john@example.com' })
  @IsEmail()
  @Transform(({ value }) => value.toLowerCase().trim())
  email!: string;

  @ApiProperty({ example: 'StrongPass@123' })
  @IsString()
  @MinLength(6)
  password!: string;
}