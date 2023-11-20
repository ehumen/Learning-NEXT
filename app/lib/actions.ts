'use server';

import {id} from "postcss-selector-parser";
import {z} from 'zod';
import {sql} from "@vercel/postgres";
import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {signIn} from "@/auth";

const InvoiceSchema = z.object({
    id: z.string(),
    customerId: z.string({
        invalid_type_error: 'Please select a customer.'
    }),
    amount: z.coerce.number().gt(0, 'Please enter amount greater then $0. '),
    status: z.enum(['pending', 'paid'], {
        invalid_type_error: 'Please select an invoice status. '
    }),
    date: z.string(),
})

const CreateInvoice = InvoiceSchema.omit({id: true, date: true});
const UpdateInvoice = InvoiceSchema.omit({date: true});

//----------------create Invoice request-----------------------------------

export type State = {
    errors?: {
        customerId?: string[],
        amount?: string[],
        status?: string[],
    },
    message?: string | null
}

export async function createInvoice(prevState: State, formData: FormData) {
    const validatedFields = CreateInvoice.safeParse({
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status'),
    });
    //If form validating fails, return early errors. Or continue
    if (!validatedFields.success) {
        return {
            errors: validatedFields.error.flatten().fieldErrors,
            message: 'Missing Fields. Failed to create an Invoice'
        }
    }

    //Prepare data for insertion to database
    const {customerId, amount, status} = validatedFields.data;
    const amountInCents = amount * 100;
    const date = new Date().toISOString().split('T')[0];

    try {
        await sql`
        INSERT INTO invoices (customer_id, amount, status, date)
        VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
    `;
    } catch (error) {
        return {
            message: 'Database Error: Failed to Create Invoice'
        };
    }

    revalidatePath('/dashboard/invoices');
    redirect('/dashboard/invoices');
}

//-------------------update invoice request-----------------------------------------

export async function updateInvoice(prevState: State, formData: FormData) {
    const validatedFields = UpdateInvoice.safeParse({
        id: formData.get('id'),
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status'),
    });

    //If form validating fails, return early errors. Or continue
    if (!validatedFields.success) {
        return {
            errors: validatedFields.error.flatten().fieldErrors,
            message: 'Missing Fields. Failed to create an Invoice'
        }
    }


    const {id, customerId, amount, status} = validatedFields.data
    const amountInCents = amount * 100;

    try {
        await sql`
    UPDATE invoices
    SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
    WHERE id = ${id}
  `;
    } catch (error) {
        return {
            message: 'Database Error: Failed to Update Invoice'
        }
    }

    revalidatePath('/dashboard/invoices');
    redirect('/dashboard/invoices');
}

//--------------------------delete invoice request--------------------------------------
export async function deleteInvoice(id: string) {
    throw new Error('Failed to Delete Invoice');

    try {
        await sql`DELETE FROM invoices WHERE id = ${id}`;
        revalidatePath('/dashboard/invoices');
        return {message: 'Deleted Invoice'}
    } catch (error) {
        return {
            message: 'Database Error: Failed to Delete the Invoice'
        }
    }
}

//------------------------authentication----------------------------------------------

export async function authenticate(
    prevState: string | undefined,
    formData: FormData,
) {
    try {
        await signIn('credentials', Object.fromEntries(formData));
    } catch (error) {
        if ((error as Error).message.includes('CredentialsSignin')) {
            return 'CredentialsSignin';
        }
        throw error;
    }
}