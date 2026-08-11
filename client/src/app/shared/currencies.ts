export interface Currency {
  code:   string;
  symbol: string;
  name:   string;
}

export const CURRENCIES: Currency[] = [
  { code: 'USD', symbol: '$',    name: 'US Dollar'          },
  { code: 'EUR', symbol: '€',    name: 'Euro'               },
  { code: 'GBP', symbol: '£',    name: 'British Pound'      },
  { code: 'CHF', symbol: 'CHF ', name: 'Swiss Franc'        },
  { code: 'MKD', symbol: 'MKD ', name: 'Macedonian Denar'   },
  { code: 'JPY', symbol: '¥',    name: 'Japanese Yen'       },
  { code: 'CAD', symbol: 'CA$',  name: 'Canadian Dollar'    },
  { code: 'AUD', symbol: 'A$',   name: 'Australian Dollar'  },
  { code: 'TRY', symbol: '₺',    name: 'Turkish Lira'       },
  { code: 'CNY', symbol: '¥',    name: 'Chinese Yuan'       },
  { code: 'INR', symbol: '₹',    name: 'Indian Rupee'       },
  { code: 'BRL', symbol: 'R$',   name: 'Brazilian Real'     },
  { code: 'PLN', symbol: 'zł',   name: 'Polish Złoty'       },
  { code: 'NOK', symbol: 'kr',   name: 'Norwegian Krone'    },
  { code: 'SEK', symbol: 'kr',   name: 'Swedish Krona'      },
  { code: 'DKK', symbol: 'kr',   name: 'Danish Krone'       },
  { code: 'SGD', symbol: 'S$',   name: 'Singapore Dollar'   },
  { code: 'HKD', symbol: 'HK$',  name: 'Hong Kong Dollar'   },
];

/** Returns the symbol for a given currency code, e.g. symbolFor('EUR') → '€' */
export function symbolFor(code: string | null | undefined): string {
  if (!code) return '$';
  return CURRENCIES.find(c => c.code === code)?.symbol ?? (code + ' ');
}
