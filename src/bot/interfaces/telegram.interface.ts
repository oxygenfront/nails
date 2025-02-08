import { Context } from 'telegraf';

export enum StepsEnum {
  name = 'name',
  numberPhone = 'numberPhone',
  editName = 'editName',
  editLastName = 'editLastName',
  editPhone = 'editPhone',

  addFreeSlot = 'addFreeSlot',
  addOccupiedSlot = 'addOccupiedSlot',

}

export interface MyContext extends Context {
  session: {
    name: string;
    numberPhone: string;
    isRegistered: boolean;
    isBooked: boolean
    appointmentIdForEdit: string,
    step: StepsEnum | null;
  };
}