import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class RecommendationsQueryDto {
  @ApiPropertyOptional({
    description: 'Maximum items per section',
    default: 10,
    maximum: 30,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(30)
  limit?: number = 10;
}

export type RecommendationSectionType = 'track' | 'artist' | 'playlist' | 'album';

export interface RecommendationSection {
  /** Stable id - the frontend maps it to a translated title. */
  id:
    | 'recently-played'
    | 'new-releases'
    | 'trending'
    | 'artists-for-you'
    | 'made-for-you'
    | 'because-you-follow';
  type: RecommendationSectionType;
  items: unknown[];
}

export interface RecommendationsResponse {
  sections: RecommendationSection[];
  /** True when the user has no history/follows and fallbacks were used. */
  coldStart: boolean;
  generatedAt: string;
}
