import { Controller, Get } from '@nestjs/common';
import { ApiBadRequestResponse, ApiOkResponse } from '@nestjs/swagger';
import { ApiResponse, ApiResponseError } from '../common/dto/reponse.dto';
import { LocationDto } from './dto/location.dto';
import { LocationService } from './location.service';

@Controller('locations')
export class LocationController {
  constructor(private readonly locationService: LocationService) {}

  @Get()
  @ApiOkResponse({
    type: ApiResponse<LocationDto[]>,
  })
  @ApiBadRequestResponse({
    description: 'Bad request',
    type: ApiResponseError,
  })
  findAll() {
    return this.locationService.findAll();
  }
}
