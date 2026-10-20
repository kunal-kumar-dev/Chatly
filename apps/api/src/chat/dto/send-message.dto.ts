import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class SendMessageDto {
  @IsString()
  @MinLength(1)
  @Matches(/\S/, { message: 'content must include a non-whitespace character' })
  @MaxLength(4000)
  content: string;
}
