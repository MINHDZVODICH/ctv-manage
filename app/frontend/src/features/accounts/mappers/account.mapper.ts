import type { AccountDto } from '../types/account.dto';
import type { UserAccount } from '../../../shared/types';
import {
  accountToUserAccount as sharedAccountToUserAccount,
  accountsToUserAccounts as sharedAccountsToUserAccounts,
} from '../../../shared/mappers';

export function accountDtoToDomain(dto: AccountDto, index = 0): UserAccount {
  return sharedAccountToUserAccount(dto, index);
}

export function accountDtosToDomain(dtos: AccountDto[]): UserAccount[] {
  return sharedAccountsToUserAccounts(dtos);
}

export {
  sharedAccountToUserAccount as accountToUserAccount,
  sharedAccountsToUserAccounts as accountsToUserAccounts,
};
