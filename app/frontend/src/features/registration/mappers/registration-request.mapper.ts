import type { RegistrationRequestDto } from '../types/registration-request.dto';
import type { RegistrationRequest } from '../../../shared/types';
import {
  requestToRegistrationRequest as sharedRequestToRegistrationRequest,
  requestsToRegistrationRequests as sharedRequestsToRegistrationRequests,
} from '../../../shared/mappers';

export function registrationRequestDtoToDomain(
  dto: RegistrationRequestDto,
  index = 0,
): RegistrationRequest {
  return sharedRequestToRegistrationRequest(dto, index);
}

export function registrationRequestDtosToDomain(
  dtos: RegistrationRequestDto[],
): RegistrationRequest[] {
  return sharedRequestsToRegistrationRequests(dtos);
}

export {
  sharedRequestToRegistrationRequest as requestToRegistrationRequest,
  sharedRequestsToRegistrationRequests as requestsToRegistrationRequests,
};
