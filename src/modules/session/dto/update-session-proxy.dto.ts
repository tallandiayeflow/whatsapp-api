import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, IsIn } from 'class-validator';

export class UpdateSessionProxyDto {
  @ApiPropertyOptional({
    description: 'Proxy URL for this session (null to clear)',
    example: 'http://proxy.example.com:8080',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  proxyUrl?: string | null;

  @ApiPropertyOptional({
    description: 'Proxy type (null to clear)',
    enum: ['http', 'https', 'socks4', 'socks5'],
    example: 'http',
  })
  @IsOptional()
  @IsIn(['http', 'https', 'socks4', 'socks5'])
  proxyType?: 'http' | 'https' | 'socks4' | 'socks5' | null;
}
