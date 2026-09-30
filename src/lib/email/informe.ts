import { queryAudit } from "@/lib/db/pool";
import { getBackupSummary } from "@/lib/backups/repository";

const UX_LOGO_SRC =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAJYAAABQCAYAAAD7sIxLAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAeV0lEQVR4nO2dC1NT19rH90fgE7zNOa29oK3RilqsbbT1ri1t5505cy4lrZdatUqtWsQiAUUECkHuihAQEbG1VAXBawSlCEoRxdp62yfkskPfGfIN1vPOuu29dgiQkChUs2f2VBECJb/5P//1X89+liRFr+g1EZdss8QM1mZMV2wWE/6zbLNI4h29olfQl2xLivm/+t1p3ro02Vubjrw16chrywBv5R5QDu+RvYcyt3gO733Bc3hvFK7oFdz1Z8PuxMHjqT5vXSp4j6aB94gFvNUWoGBlgFKxF5SDmaCUZ8qukkxzFK7oNeY1+ENK2mDDLvDWfwcUrN06sBQO1qFMpJRlglKaBUpJdtpfAa6yuTdMlfE3bba3uuUj8d2+o/Gdcv3bnfaGdzoT6012Q73JLkVve8R+B+rlbtiZMPjDLhhs2IUGj6cysNLAW2tBDCzkrdqDMFheDFY5AQspJfuRUjR54bIaew3lc3rtFXN7oHLuTVT9VjccmdcFdfO6UP3bv8CJd36Bk+90yCdN15JOmq5J0ftaRH4H5HI37JS8J3fKGCxvwy4YrP8ODR7bDYO8FNakE7AU7LFUsPaBUroPlJL94CncD0pR7qSDy2rsNRbP+tVXPvtXdGjOTaicewNsGKz4Lqh7+zocn98JJ+b/gk6+8wtqfPcqnDJdTTtluipF76th/w7IpZxMNg+e3Im8J1JgsOE7sRQiASxi3r2H9yLl4F5QyvchpYwqFgGrMAcp1skDF4aqaNatoZLZvVA2+1eomNODsGIRsOZ1wdF51+H4250IK9aP71wDDNZpUzs0mdqTmkztUvRuD+t3QC7vT8l2DBYthQysY6J5x2DtQQwsqljEY2HFygKliILlseYAhkux5k4oVDnGXqP1zT5fUdwtKInrBaxYGKzD/oqFwZpPSiFRrNOmq6h5QftQo8keEwWrPXyw/vxpp4+CxRUrFYOF/Mw7AUup2IPBwooFXqxYxcRjIeVADigFuciTlwtKXl7aREKVN/O2r2DWbSiMuwWlcbdQ+ZxfgZbCmwSs2vhuxBSLlEJNsa5C84J2aF5ot0TBag8frMHGZETAOsE81vHvkPfYblWxlGrusXjcsBe8uBSW7gNPcRbxWJ4D2eCx5gIDCym51jQl1/pUocqb0T89Z0b/UN7M21DwZh8UxfVBcdyvpBQemtsDXLFq4q9T8048VgdoHqsdmha0Qct7V+xRsNojoFgYrB9TgHisE3hVSM27t1Yz70pVOlDzvgfHDTjHAg8phdlIKcwGrFie/BxQ8r9Hnu/zwJOTD08TrkxjvzFrRr8vZ0Y/5M28g6wYrFm3EC+Fh+behCq8Koy/MawU/kTAukY91oI2aF14xRcFqz0CivVTsuz9cSeQVeFxnmNpikVLIQYrA7wVexFfFZJSyFeFB3IQL4We778nYLn354OS9eThshj7jZnGu74sYz/kzLwDWLEwWIWzbgE277QU9qDKt25C9Vs30JF53dqqkMYNqnlvXtgOrQvbUBSs9oiY94JBBpa4Khys2414jkUVK4OuCqnHQiQgZaVQIaUwh5RColi5+chDwCpAStaBJwaXJfa+MeON33z7jL8hAtaMO5D3JgMr7hYrhT2AFQvHDaJi4RzrBxI3iGC1Qet7UcVqigRYyg/JJlWxGFiDx3Yj/aqQeiwv29KhHgsn7/tJKVQ9Vv734MnFipVHFMu9zwqezANIySyKOFypUx9PT3/j96GM6fcg0/gb7J9xF3Jn9kP+zDuo4M3bCHus0tm3kBo3cMWKp3ED9Vh0Vfjzu9cQM+/o7AJ71GOZIgOW9OePO+3YY3GwRPNOSmEVy7EqcI5FV4XEY6mKReMGAhbzWBgsT1YBuDMPgHvPAVD2RA6ulNj7xtTX//BZ3vgdMt64B5nT7xKwcmb2a4qFPZZaCm8S805LIQMLJ+8ULC3Hwubd1JYYLYXt4YOFL7nREuM9kSJrq0IWkJJSSM0739LhYNFSiFP3bOQpyMZxg1oK3apiaWC50wtBSS9Ji4RS7Zr2cCj19T/A8vrvsOeN31HmdKxY/ZA7ox9hsLBi4VJYEtdL44a5PcS82+Jp3EBLIfVYOG742YTN+1VoMrU9bjG1jfmLA4AYADCMdTeN400J5nXZ98efG/TPEuDrIvb/6f/aukupTzZ4j++SyV4h3tLBHouvCm3+HisTSPKOFasIl0KSY4En73sSN3hy88Gz34oVC6lgZRSBO70YKbvL0pTdZRK+Q722x9437pz60Ldr2gPQwLqHeCnE5p2XQq5YxGPNwXuFXLG6oY7lWD/M7yQei5bCdmhdcHV6kGCZIIiraXxg2YN4aYsICADIwfw8AOATARjj58C3DYK/DAHBUuGqT5XxqnCQb+kwj0UVa4+wCU1zLOqxcph55x5LBYspViG404vAbSkC9+4ScO8uS3OHCFdS7H3jjtjHQ8lTH8KuafchdRoBCxGPNZ2bd+6x+oYpFtkrFBTr+NvXteTddA0aTe3m1gVXpb8oWKYQALCOBRb7d3MIr1kg/jwBLwLXsVRZA0voxzrMzPtBGpDSLR0RrFwOFvJkWxEFq0AthW5LMQXruxJwpwQPV1KsbPzmNXloe+wjlDz1AaRMfYBUxWJgccXiAakuecdgvUWTd+qxOnmOhU6+2wEnTR3mRlO79BcGS2JvbkjqMgpUhhBUUPYvsSNeSr3F4D26Wx6kHguJWzpsE1pTLAKWX9yAFSubKdbeAvDsLWRgEcVCLgoWcqccHBOur152TU96TfZtfe0xbH/NDyxm3vdhsIx3kVoKZ/nlWCJYfFXItnROzu8wnzR1SM8AWDGs1AVz4e8xElQSU7VgL7P/zzLqpdgsBm9NmszNO/NYgmIR8448RXxLhybvxGNRxQLPPisphZ69hcidUYTUUphaSsFKLkfuHSPDtXaKbPzqFYcv6VUZtr76iID1bexDlDIVl8L7iJRCvCo0/gZqQIrN+yycvPfRVSFvm3lL3CvsJHFDw7zOxJPzO6RnBCwJAJJCAMI0AlRYrYK9bIF+jjEvCle6zDtIsXnHHksDi3Y3MPOOPPmCYu33A0vzWKpiuXaWg/vbg8i9o2IYXGunuIwbpwwMffXKfwGD9Q1WrNiHsHPqQyBgqYr1Gy2FxrtItyrEikW3dFjyjvcKbwA1713o2LyuxIZ5ndIzBpYU5NfjSw4AFb57g/160bCHChaFy5Yhe6v2srgBl0LamsxLoaIFpEgMSPGqEAekFCzusYqpx9pVCgwscG0/hNzbNLjMU1zGL14a8G2c4oDNr/wXtrwio62vPkYYLFwKyaqQm3cC1l0gpZAk73cIWESx4nBAileFLHlXA9KuxGPzuqRnFCwDjL+MmcMpgUGDpYOrco/s1bcm0+SdtM2QHAsRsMheIcuxsqyCedcUC5dCVwoGqwxc35YTsJzfHALn1oo0DNW6F11D66cMwIYpDvjqZQcSFYt6LG1VyMw7K4UsIMUei/djzdF3N9jiu81H53VJzzBYEvv3kOOHEAx7wBIYElgqXGUWg3KIPP6lC0hZ8q72Y/G9QjV5p+YdeywGFlasUnDtKgX3znIClnvHIXBvq0A3VjfA6hfdvrUvOmH9FCcBCysW9ViP0fbXHsK3RLG0UkjBooqFt3SwYomb0KRthnisG1A5t9tsi++WngOwYkKAhL9WWrglMGSwRLi8BzNlAhbrbtBWhbli24wQN9CA1EPMO48bSpFrVxkvhQgr1o01DWj9Kw4MFqx7yQVfvDQAG192gOixdsQ+0hTr9T8g/fU/aI4lBKT6UtgLZXN+BfowRY+5cm639JyAJYWQbWHVMoYA4oglcFxgaXBlGZTyfTJWLK9aCvWKpbDuBpK87y0QAlIVLF0pvLOxFta9PADmv7th9YsuoIpFSiHSmffXRI91HxHFeuMe2me8R3Ms1t0ggsVKoblybo/0nIElAUBjkLCEFFNEHCwdXKVZMu/H0iXvrB/LHyymWMi1uxjUHGtnOTzcWgmbpj6GT/+mgPnvHqJYa1+iYBHFepmVwtceMbBw3PAAYbCwYpG9Qh438LYZzWOh0tm9iYcIVM8lWIYQoAnmMjwxsHRwlWTJTLGQX/KOA1LkUc27PiD1fFeK3KQUlkHVijb4l8GrgvX5312wjoOFzTtbFVLz/gi+jX0AKdOEgJR5LAwWiRt4ox8Fy1w6u1d6jsGSQsy2IvI9w7oIXNYsg1K4X/bzWIgn76Qfax+LG0SPRQJSat43xMo6sIjHYqVQ9FhbX2XJOwHr/rBNaK2DlLYmF8/uSyyJ65WiYEEo2dRIlxwCyOGBReCyZlG4DmTLancDAWt43MBLIQYLl0K8KuxeX4/+8cKgAJZbNe/rmXknq8JXeNzAwBK2dHgpVPuxsGLF9ZqLZ/dJUbAgVCMfVgmMGFg6uKw5stZBykshbpthOZa6pUPiBoTNe9vnP8I//mfQT7Fc1GMRsAYYWI85WJAc+5Aq1jR93JA1g+ZYOTNvm61xvRIGayy4npNSKI1jkzqs7xWxS4UrP1fmASkz77qA1EMVC7lTcfJehsHyUyy9ed8wvBSCVgrpqpDHDcy8+3Li+o0iWKPB9ZyBFTMOI+8bx/eJHFgqXFlZBk9unqzzWJkHkNo2k05XhTxu6F5fD/5gfS7EDXRVKAuKxeMGca9QCEjpXqHPGtdrFMEaCa7nDCxDCFmVeCVNKFgaXFaDJydf1jf6qf1Yqsfiq8LPXnJpYP3NTcEiiuUMHJDGMrCmiWD9poKF22ass/p8hbP7p48F13MGlg3Gd/kmxGONCNf+fNmdVUBWhepeYRrzWOpeYTlUraRxw3/EVaGQY2lbOo9Y8s46SNmqkHWQUvM+4w5Sc6xZt/CkmVHhCgMs418MLDOEd9knHCwdXFlW2aNt6TDFYmDtKiNxw8OtVWj1FJduVaiZdw0sNXmPHaEU4se/ZtxFfEuH7RUOjQZXGGAF20HwwiQAa7wlcNwl8YleHC53ZoGMO0hJ3JDOzLtuS+cgnP/XabUUqnEDM+8qWK9qpVDtx3rd7/Ev3jaDh4Kwfqyy2T2+krjugJ4rDLCwEQ7mMo4DLF8k9usiUALHXRKf+KVkWaly7TkgC8k773knjX68bebU/7ao5n2d6rEGmHmnYG33L4W65F3bK9Q9Yk87SH2VAZQrDLCCBcASIlTB5k2mp1QCn95e4bjgslgN7vQDsgYW7m6gikW7Gw6C65tDcOaTFiQqlr9518cNQo4lBqS8NZk9TEEfsSc97z5bXIfRFtch8Xu8cLFfoH0c/U6SeAd4zWDVJSbCJbA3kiXxqV0cLo+lWOZbOrgUkp533Jq8/RBybasA19bD0PRJi95j4U3oV3jPuxA3TBNKodg2w8cYzepDeHYD7m6gE/1Io5+vdnbX9NrZXRK+xwtXiM10trHAYn/fEgIEkS6BhhBamscsiU/1UuHaXSKr3Q0ULMBgubdV4A5ScCVVouaPWxFVLJa884cpApRCnWKJ3Q1aKdQ9pVMb3zVUF99hrIvvGBOuMcAKZZukMdCbIfi1YKEa9gxfBEqgbRydEKOWxKd+UbjKDO7UUpkrFvFYOw6RUugiYB0G5+ZKOPtxq6ZYamsy3dIRn4TmOZbaNiN0N5DnCmf3It0MUjJtpst3/O2u6WPBNQZYwZZDf8As7I1PYm9qqGn4WAY61GcCxdcLVoVHLYkTcnG4XCmlsuaxaClkigXOLVXg+sqGzn7UOmoHqRo3YMXi5h2XQt6PJT7+xWY3qMNt51/3jaVcQYAV7uZuqJctwiXQEsa2z4glccIuDJecXGZw7yyXNfNegbDHwqXQtbkKOTdVgXNjNbR81DosbtApFi+FRjrGSAVLN3gt0HwsMhTEd2IUuIIAazyq9SSX++YItMKE8hoBS+KEXkS5MFzJ5bIGVgW4vj4Mrs2VRLFcG6vB9WUNak04p2tNTgm0pcPmY9FVIcux/BVLPUCAgkWGgrzb4Ws0BYYrSLAiFUCGm12F+nOM9nr2cErihF9Etb4tl4l5/6YC4VLoTMJg2ZDzqypwbaxGzg014FxfA+c+bFXjhhHNO18V6gJSbT6W6rEwWPN047h9ZxZcHea5ggTracBliXAJHKukhmLkhynpBENlNbiSy2QakOpKIVcscG60AQHrixpwrquF8x+cQ98GSt5H91hs2gxVLDJtZt51RKbN6A8QGGo22Y3NJrvE70kAly/IlD3UEmiIcEuzriRO2KUkWw1uZt5dO5jH2lYB7q2ViCpWFWCPhUuh88tqoljOdUdgYM1RuLDq3LBH7Pfp4ga8V4g9Vq9aCtVRkdhjsbN0OFh42gyemnyGHSAQJlwSU5dIAGYPEoBIlsCIlMSJg2pXiexmm9Bi8u7aehgR876lCnApxOadKtYRhMFyrj0Kzs/rEIaLKta94R5rpjDRT/VYPcKqsFucNkNnkJqukTnveAYpHsfdvMhubF4UFlwG9gaGauxlllMFu2UjghzMHUwGJt78ecNg7l6+I/D0oWIBKd4rJDmW8Ii9Wgq/pnGDk5RCCtbAFzUwgMFacxRhsJyfHYNLq84N725QPZY2550eIMCmzWCwSCnUFOtHdQYpUSyEx3Gff+/K0Pnw4ZLYHcNASWIQ2IS7gH08IdSep8l8P3Wo3GlsS4d0N9BGP65YTq5YGKzNleDcZEPEY31Zg7jHGlhTSxRrwFwHA4nH4NLKczrzTsBim9DqGCP9lo52rNx8vCqkg9f4qMjmBW0MLDtcWnR5yL7ofKTgkp6n+6lC5UkvJJvQtDWZKRZP3oli0eSdeCz/Urj+CPFYmmLVIwzWwKf1cHnFebXnXYsbGFh4VCT3WOwsHXVVyIbb+oEFLQuvAAHr/ctwZfGloatLLk+PwgWTDywZK1XGAVmb3aA9paNOm9lBzbvqsTZXIXVVSBTrCCmFWLEGPj8KA58dA6e5HpyfHoeBfzUg+/Lzur1CPuddnUGKPRYvhfO0gJQrFimFC9qhaaEeLPuiS9C++KKvI6pc0qQCizf66WaQptJGP97zjhv91O6GryswWLQUqmBV07hhbS0ipXA1BWvAXA8D/6mHgX83gOOf9ZZsY3/isCNP4gKUQlGx5rO4waSdTNGy8AophRexYi26hNqXXISOJRd8XUtaJ5tyxQTZPhPsa/01SiFtTS6QycMUuhmkfPCa3mORUvj1YR438ICUJO88bsClcOAzfNeBM7Ee4VLo+HdDmuOf9VK2sV/KMd42C4qF/McY6ZJ3dpaOYN61Uvg+B+syal98ETqWXoDry875OhY1GzsWNUv45s2CYcBlFsx8AfuzMYQ3EH/9CxGCwfyXAIs8BrY/X8ZP6dDHv/hQkCKuWIgPBVED0m2B4gamWASsWuRUzfsx5EzEpbA+zfHvBkkAS7LOvG3mjX58VCTvbuB7hXRqspZjsSNPEDtWjpRCDJadK9bSC9C59Bx0LWv1dS9qNnYLYI0GV1NwXaOBABk27F8Y5u8PFh/gH0jNAq00A31cBCuYrxtJLZ9c3ECgysmT+bQZ/jAFfxJaNO9MsWg/Ft8rJKWQdDcQsFzcY61likU8Vh04zHUW56f1UgCwpANv9iUSsNSpycJeYXyXdjIFOa+QKhYOSNmxcogrFvFYiy6gjiUXEAare1kr3Fze6vt1SeuwNucIgWVgypXAPs7f8AQWS/DYgudk/HP55/M32Mb+bmITkDkE5lE+Huj7cAVNEj5uYQob47dPyH+mJwQVfmCVzMfShtuqJ1P4lUJVsUg/Fs2xcCnkbTN0SwcrFgtImXl3mGstjsQ6aRSwpMK4XjMfvMYPENAd0qQFpIAPEBBXhefeu6yCdXXxRURK4dLzqGtZK/Qsb0W9K8/6+ldGBi7Qg+VfkvgbF2iv0OxXOsXPsfm94Twn81cm/vrmEb6PhX2e/8/Fg9YkAU71ayMOlZKfJ9NpM3lkdgN+ElodY5RRBJ70EqROm9E8Fo4bePJO2macW7h5rwaXGjfU0rhhTa3FYa6VggBLKonrMROw5tAZpMPB6hD2ClkpVFeFdsRWhdi8IwxW93IG1oqz0Leyyde/vHnY0z9N4YFVIKgKv2NGAUssoeLniCBwoEwBEn1LEGBxMAN9HYfTIL525KDiQ0HoRD+ED2niZ+nQUkjNO53doDfvoseijX5YsSrBtUmnWMy811gGVh+RQgBLKpvbY+atyRpYeo9FFesqUuOG90lASleFiy+ia0vOQycGi5TCFsBg3V7ZjPpXNfn+WHkmLOUCPSD+bz73NLz0iP4mVLBi2JzRYaVL+K+45cPLMv84/1lMrBNW/L6mUc/SGc8lWy0xbIyResKqMCqSKhZ/rpANBeFjjNTHv3iONXxViEiORcCqsQysqZEcn4cMlnRobrdZLIV0S4e1zTDzzjahkS7HWowV6wJQsM5B9/JzcHP5WQbWWdS/6gz8/sEZX39C47iVC6gaiEbY7OdpxDeZ/1vMCF/H/+wPp/g6fAtJ/PyEUb4Ph1n0XyLEhqDO0gkRKkkpyk6jE/3Y4DU25109/YtMTcYPq9JSqJp30WP5l0Lc3cDiBroqrE0bWFcjOcYPFh4CYqaHjdO4Qd82I54JzbZ03rcjrlh6894CvcvPotsrm+HuyiZ074Mz6MGHp4fuJTQa/OEqDuIOUOIm420aQQEl9iCIIfJgCRP9+LFyWLHo4DUSN6il0CXOeWfjuN3JB6l5Z49/4VLoIh6LxQ0bbBbnlzXSwBc1kmNtjeRYXSM5PqNwhQiWZJvbadYOG1dP/1JXhSwgpYq1CJv3i9C2+AIMA0srhXDvgzPwx4en4GHCz3JvQmPMeOCa7LegdFzN/NVPB2LYl7Moy8RnkCoELOqxSCnkhzRlsjnvbGqyhzxi79/dwNtmcDmsJHuF2GO5N9WkuTZWS84N1dLA+mrJsa5acqyplhyfU7jGAZZ0JL7TXPd2VwDzzs6ExoqFPdb7l5liCaVw2TmEzfutFUSx0B1aCtH9D09jsODRx42WiYZgMtxhX+6iLAs98oQOt1XnvLO4wa0PSP2OPBFLodqPReMG0t1QaXFtskmujTbJucEmDXxpkxxf2CTHWpvkWE3hGidYUl18p9l/EzqAxyJgUcW6iDpZ3EAUayVeFTYDBuveB6fh/oenEQZL/rjRJyfYnknVeqpgKSXZaerUZOHoXq0U4sFr9Fg5XfLO4ga10Y+UQu25QvfmyjTnpkrJualKcm6skpwbqqSBL6skx/oqybGuSnKsoXCFAZZUP7/TTI6VUw8bV/cKxbgB6eIGsRSuaoZ+DlbCaXj40c8gf9QIcsIPpol+Y58ZsLTTv+jUZHd2njrRj+dY2qpQaJvZWY5c3GPxtpmtFRb3ZgwVuzdWSs4NldLAl5WSY32l5PiiUnKspXCFCZZ0Ap9VqGub0RTroroqZOZ92TnoXtqKGFgIKxb1WIJifdQIjk8at0z0G/vXB6swy0xKYaEw552fTMGG22Lzrp3+RZN3lwiWmmNRqJxbK6QxwVpH4YoAWNJJU7tZ9Vj+ccMiDSymWMRj9a5oJqWQKNaqM4iZdwwWcnzcmDbRb+xE35HJsJhiCR6LJu/8ZArd0b3a1GT/TWjntoMEquDBqowUWPhxevNwxbpEwGrTmXdaCrl5v7uqCX7jpZAplpzQmDDRb+yzAJakFOXYeY6lnVeYz88r1KYmZ1CwXBpYqsdy7iizOLcdlCYQLOmUqS1Rn2NdRjhuELsb+KqQxQ2kFLJVIXqUcArJH/+MwRpXnvUs3REB68+SHCPOsWjyTg8QUIRNaHVqsnCWjnisnDv5YJpzR5k0EWD5w9Viaktsfa8NLrx3BWHFUuOGxTTH6lrWogtIVfPOPNbjjxp75YTGCX9jnxWwJO+BnC3EY+lKIe9uYIeN401oSzHy8KnJKWXImVJmcScflCYSrGFwLbSbtYD0khCQYo91DvUsa+Gb0My8U4+FFethQqM5ClZkwZIUa26agk+mYGdCK9kF3LyTHMvPY4EnpXyLM6VMmgxg+cN1fqHdfHERWxUuuah6LJJjraCrQlGxMFgPEk5ZHyY0SlGwIg8W6XLA/Vg8eWcHCAiNfsXIlVpsH0wtnD6YWihNJrD84bq06JL5yuLLQ3rFUnMsule4iu4V3v/glPVBwikpClbfEwNL8uTmSUqu1eTOtqa591kbPXsL7O69hTZPRmGS01JkclqKJPWeZGD5w2Vfaje0LT5f3bHkAvyi3ytEJCBdeab391WnP7z/wSkpClbfUwFLcmePfU9GsES47EvtUtvi85J9aYuhc2mLuWt5i6VneUtaz4qzSb0rz5j6V56Rfl91WoqC1ffEzPszBRaHSwBL6lzaInUtb5F68L3irNS78owUBavvia8Knzmw8B0Fq29cccP/A9DRI3azFvY4AAAAAElFTkSuQmCC";

export type ServerBackupDetail = {
  resourceName: string;
  resourceId: string;
  resourceType: string;
  vaultName: string;
  backupName: string;
  status: string;
  sizeBytes: number | null;
  backupCreatedAt: string | null;
  backupCompletedAt: string | null;
  backupExpiresAt: string | null;
};

export type AccountDetail = {
  accountId: string;
  accountName: string;
  region: string;
  vaultCount: number;
  totalBackups: number;
  successfulBackups: number;
  failedBackups: number;
  inProgressBackups: number;
  expiredBackups: number;
  serversWithBackup: number;
  totalServers: number;
  lastBackup: string | null;
  servers: ServerBackupDetail[];
};

export type ProviderReport = {
  provider: string;
  totalBackups: number;
  totalBytes: number;
  accounts: AccountDetail[];
  successfulTotal: number;
  failedTotal: number;
  inProgressTotal: number;
  expiredTotal: number;
  successRate: number;
  failureRate: number;
};

export type InformeData = {
  generatedAt: string;
  dateLabel: string;
  aws: ProviderReport;
  huawei: ProviderReport;
  globalSummary: {
    totalBackups: number;
    totalBytes: number;
    successRate: number;
    failureRate: number;
  };
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatBogota(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-CO", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatDateShort(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-CO", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function statusColor(status: string): string {
  const s = status.toUpperCase();
  if (["COMPLETED", "AVAILABLE"].includes(s)) return "#10b981";
  if (["FAILED", "ERROR"].includes(s)) return "#ef4444";
  if (["IN_PROGRESS", "PROTECTING", "CREATING", "PARTIAL"].includes(s)) return "#f59e0b";
  if (["EXPIRED", "DELETING"].includes(s)) return "#71717a";
  return "#06b6d4";
}

function statusBg(status: string): string {
  const s = status.toUpperCase();
  if (["COMPLETED", "AVAILABLE"].includes(s)) return "#f0fdf4";
  if (["FAILED", "ERROR"].includes(s)) return "#fef2f2";
  if (["IN_PROGRESS", "PROTECTING", "CREATING", "PARTIAL"].includes(s)) return "#fffbeb";
  if (["EXPIRED", "DELETING"].includes(s)) return "#f9fafb";
  return "#f0f9ff";
}

export async function generateInformeData(): Promise<InformeData> {
  const summary = await getBackupSummary();

  const now = new Date();
  const dateLabel = now.toLocaleDateString("es-CO", {
    timeZone: "America/Bogota",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  async function buildProviderReport(provider: "AWS" | "HUAWEI CLOUD"): Promise<ProviderReport> {
    const providerAccounts = summary.byAccount.filter((a) => a.provider === provider);
    const providerTotal = summary.byProvider.find((p) => p.provider === provider)?.total || 0;

    const statusForProvider = await queryAudit<{ status: string; total: number }>(
      `SELECT status, COUNT(*)::int AS total FROM server_backups WHERE provider = $1 GROUP BY status`,
      [provider],
    );

    const bytesRes = await queryAudit<{ bytes: string }>(
      `SELECT COALESCE(SUM(size_bytes), 0)::bigint AS bytes FROM server_backups WHERE provider = $1`,
      [provider],
    );
    const totalBytes = Number(bytesRes.rows[0]?.bytes || 0);

    const successfulTotal = statusForProvider.rows
      .filter((r) => ["COMPLETED", "AVAILABLE"].includes(r.status.toUpperCase()))
      .reduce((a, r) => a + r.total, 0);
    const failedTotal = statusForProvider.rows
      .filter((r) => ["FAILED", "ERROR"].includes(r.status.toUpperCase()))
      .reduce((a, r) => a + r.total, 0);
    const inProgressTotal = statusForProvider.rows
      .filter((r) => ["IN_PROGRESS", "PROTECTING", "CREATING", "PARTIAL"].includes(r.status.toUpperCase()))
      .reduce((a, r) => a + r.total, 0);
    const expiredTotal = statusForProvider.rows
      .filter((r) => ["EXPIRED", "DELETING"].includes(r.status.toUpperCase()))
      .reduce((a, r) => a + r.total, 0);

    const accounts = await Promise.all(
      providerAccounts.map(async (acc) => {
        const vaultRes = await queryAudit<{ count: number }>(
          `SELECT COUNT(DISTINCT vault_id)::int AS count FROM server_backups WHERE provider = $1 AND account_id = $2`,
          [provider, acc.accountId],
        );
        const vaultCount = vaultRes.rows[0]?.count || 0;

        const statusRes = await queryAudit<{ status: string; total: number }>(
          `SELECT status, COUNT(*)::int AS total FROM server_backups WHERE provider = $1 AND account_id = $2 GROUP BY status`,
          [provider, acc.accountId],
        );

        const successful = statusRes.rows
          .filter((r) => ["COMPLETED", "AVAILABLE"].includes(r.status.toUpperCase()))
          .reduce((a, r) => a + r.total, 0);
        const failed = statusRes.rows
          .filter((r) => ["FAILED", "ERROR"].includes(r.status.toUpperCase()))
          .reduce((a, r) => a + r.total, 0);
        const inProgress = statusRes.rows
          .filter((r) => ["IN_PROGRESS", "PROTECTING", "CREATING", "PARTIAL"].includes(r.status.toUpperCase()))
          .reduce((a, r) => a + r.total, 0);
        const expired = statusRes.rows
          .filter((r) => ["EXPIRED", "DELETING"].includes(r.status.toUpperCase()))
          .reduce((a, r) => a + r.total, 0);

        const serversRes = await queryAudit<{ count: number }>(
          `SELECT COUNT(DISTINCT resource_id)::int AS count FROM server_backups WHERE provider = $1 AND account_id = $2`,
          [provider, acc.accountId],
        );
        const totalServers = serversRes.rows[0]?.count || 0;

        const serversWithBackupRes = await queryAudit<{ count: number }>(
          `SELECT COUNT(DISTINCT resource_id)::int AS count FROM server_backups WHERE provider = $1 AND account_id = $2 AND status IN ('COMPLETED','AVAILABLE')`,
          [provider, acc.accountId],
        );
        const serversWithBackup = serversWithBackupRes.rows[0]?.count || 0;

        const regionRes = await queryAudit<{ region: string }>(
          `SELECT DISTINCT region FROM server_backups WHERE provider = $1 AND account_id = $2 LIMIT 1`,
          [provider, acc.accountId],
        );

        const serversRes2 = await queryAudit<{
          resource_name: string;
          resource_id: string;
          resource_type: string;
          vault_name: string;
          backup_name: string;
          status: string;
          size_bytes: number | null;
          backup_created_at: string | null;
          backup_completed_at: string | null;
          backup_expires_at: string | null;
        }>(
          `SELECT DISTINCT ON (resource_id) resource_name, resource_id, resource_type, vault_name, backup_name, status, size_bytes, backup_created_at, backup_completed_at, backup_expires_at FROM server_backups WHERE provider = $1 AND account_id = $2 ORDER BY resource_id, backup_created_at DESC NULLS LAST`,
          [provider, acc.accountId],
        );

        const servers: ServerBackupDetail[] = serversRes2.rows.map((r) => ({
          resourceName: r.resource_name || r.resource_id,
          resourceId: r.resource_id,
          resourceType: r.resource_type || "",
          vaultName: r.vault_name || "",
          backupName: r.backup_name || "",
          status: r.status,
          sizeBytes: r.size_bytes !== null && r.size_bytes !== undefined ? Number(r.size_bytes) : null,
          backupCreatedAt: r.backup_created_at ? new Date(r.backup_created_at).toISOString() : null,
          backupCompletedAt: r.backup_completed_at ? new Date(r.backup_completed_at).toISOString() : null,
          backupExpiresAt: r.backup_expires_at ? new Date(r.backup_expires_at).toISOString() : null,
        }));

        return {
          accountId: acc.accountId,
          accountName: acc.accountName,
          region: regionRes.rows[0]?.region || "",
          vaultCount,
          totalBackups: acc.total,
          successfulBackups: successful,
          failedBackups: failed,
          inProgressBackups: inProgress,
          expiredBackups: expired,
          serversWithBackup,
          totalServers,
          lastBackup: acc.lastBackup,
          servers,
        };
      }),
    );

    return {
      provider: provider === "AWS" ? "AWS" : "Huawei Cloud",
      totalBackups: providerTotal,
      totalBytes,
      accounts,
      successfulTotal,
      failedTotal,
      inProgressTotal,
      expiredTotal,
      successRate: providerTotal ? Math.round((successfulTotal / providerTotal) * 100) : 0,
      failureRate: providerTotal ? Math.round((failedTotal / providerTotal) * 100) : 0,
    };
  }

  const aws = await buildProviderReport("AWS");
  const huawei = await buildProviderReport("HUAWEI CLOUD");

  const globalTotal = summary.total;
  const globalOk = aws.successfulTotal + huawei.successfulTotal;
  const globalFailed = aws.failedTotal + huawei.failedTotal;

  return {
    generatedAt: now.toISOString(),
    dateLabel,
    aws,
    huawei,
    globalSummary: {
      totalBackups: globalTotal,
      totalBytes: summary.totalBytes,
      successRate: globalTotal ? Math.round((globalOk / globalTotal) * 100) : 0,
      failureRate: globalTotal ? Math.round((globalFailed / globalTotal) * 100) : 0,
    },
  };
}

function providerAccent(provider: string): string {
  return provider === "AWS" ? "#f59e0b" : "#dc2626";
}

function providerGradient(provider: string): string {
  return provider === "AWS"
    ? "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)"
    : "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)";
}

function renderProviderSection(report: ProviderReport): string {
  const accent = providerAccent(report.provider);
  const gradient = providerGradient(report.provider);
  const providerLabel = report.provider === "AWS" ? "AWS" : "Huawei Cloud";

  const accountSections = report.accounts
    .map((acc) => {
      const serverRows = acc.servers
        .map((s) => {
          const sc = statusColor(s.status);
          const sb = statusBg(s.status);
          return `<tr>
            <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:13px;font-weight:500;color:#1f2937;">${esc(s.resourceName)}</td>
            <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;color:#6b7280;">${esc(s.resourceType)}</td>
            <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;color:#6b7280;">${esc(s.vaultName)}</td>
            <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;"><span style="display:inline-block;padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:600;color:${sc};background:${sb};">${esc(s.status)}</span></td>
            <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;color:#6b7280;white-space:nowrap;">${formatDateShort(s.backupCreatedAt)}</td>
            <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;color:#6b7280;text-align:right;white-space:nowrap;">${s.sizeBytes !== null ? formatBytes(s.sizeBytes) : "—"}</td>
            <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;color:#6b7280;white-space:nowrap;">${formatDateShort(s.backupExpiresAt)}</td>
          </tr>`;
        })
        .join("");

      const coveragePct = acc.totalServers ? Math.round((acc.serversWithBackup / acc.totalServers) * 100) : 0;

      return `
      <div style="margin-bottom:24px;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:12px;">
          <tr>
            <td style="font-size:15px;font-weight:600;color:#1f2937;">${esc(acc.accountName)}</td>
            <td align="right" style="font-size:12px;color:#9ca3af;">${esc(acc.accountId)} · ${esc(acc.region)}</td>
          </tr>
        </table>
        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:16px;">
          <tr>
            <td width="25%" style="padding:10px 12px;background:#f9fafb;border-radius:6px 0 0 6px;border-right:1px solid #e5e7eb;">
              <div style="font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;">Total</div>
              <div style="font-size:20px;font-weight:700;color:#1f2937;margin-top:2px;">${acc.totalBackups}</div>
            </td>
            <td width="25%" style="padding:10px 12px;background:#f9fafb;border-right:1px solid #e5e7eb;">
              <div style="font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;">Exitosos</div>
              <div style="font-size:20px;font-weight:700;color:#10b981;margin-top:2px;">${acc.successfulBackups}</div>
            </td>
            <td width="25%" style="padding:10px 12px;background:#f9fafb;border-right:1px solid #e5e7eb;">
              <div style="font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;">Fallidos</div>
              <div style="font-size:20px;font-weight:700;color:#ef4444;margin-top:2px;">${acc.failedBackups}</div>
            </td>
            <td width="25%" style="padding:10px 12px;background:#f9fafb;border-radius:0 6px 6px 0;">
              <div style="font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;">Cobertura</div>
              <div style="font-size:20px;font-weight:700;color:#1f2937;margin-top:2px;">${coveragePct}%</div>
            </td>
          </tr>
        </table>
        ${acc.servers.length > 0 ? `
        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
          <thead>
            <tr style="background:#f9fafb;">
              <th align="left" style="padding:8px 10px;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e5e7eb;">Servidor</th>
              <th align="left" style="padding:8px 10px;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e5e7eb;">Tipo</th>
              <th align="left" style="padding:8px 10px;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e5e7eb;">Vault</th>
              <th align="left" style="padding:8px 10px;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e5e7eb;">Estado</th>
              <th align="left" style="padding:8px 10px;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e5e7eb;">Fecha</th>
              <th align="right" style="padding:8px 10px;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e5e7eb;">Tamaño</th>
              <th align="left" style="padding:8px 10px;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e5e7eb;">Expira</th>
            </tr>
          </thead>
          <tbody>${serverRows}</tbody>
        </table>
        ` : `<p style="font-size:13px;color:#9ca3af;margin:0;">Sin backups registrados.</p>`}
      </div>`;
    })
    .join("");

  return `
  <div style="margin-bottom:32px;">
    <div style="background:${gradient};padding:16px 20px;border-radius:10px 10px 0 0;">
      <table cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr>
          <td>
            <span style="font-size:18px;font-weight:700;color:#ffffff;">${providerLabel}</span>
            <span style="font-size:13px;color:rgba(255,255,255,0.8);margin-left:12px;">${report.accounts.length} cuenta(s) · ${report.totalBackups} backups · ${formatBytes(report.totalBytes)}</span>
          </td>
          <td align="right">
            <span style="display:inline-block;padding:4px 12px;border-radius:9999px;font-size:12px;font-weight:600;color:#ffffff;background:rgba(255,255,255,0.2);">Tasa éxito: ${report.successRate}%</span>
          </td>
        </tr>
      </table>
    </div>
    <div style="padding:20px;background:#ffffff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 10px 10px;">
      ${accountSections}
    </div>
  </div>`;
}

function esc(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function generateEmailHtml(data: InformeData): string {
  const { aws, huawei, globalSummary, dateLabel } = data;

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Informe diario de backups — ${esc(dateLabel)}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
<center style="width:100%;padding:24px 0;">
<table cellpadding="0" cellspacing="0" border="0" width="680" style="max-width:680px;width:100%;">

  <tr>
    <td style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);padding:28px 32px;border-radius:12px 12px 0 0;">
      <table cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr>
          <td style="vertical-align:middle;">
            <img src="${UX_LOGO_SRC}" alt="UX Technology" width="56" height="56" style="display:block;border-radius:8px;">
          </td>
          <td style="vertical-align:middle;padding-left:16px;">
            <div style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">MC Inventory</div>
            <div style="font-size:13px;color:#94a3b8;margin-top:2px;">Informe diario de backups</div>
          </td>
          <td align="right" style="vertical-align:middle;">
            <div style="font-size:12px;color:#94a3b8;">${esc(dateLabel)}</div>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <tr>
    <td style="background:#ffffff;padding:24px 32px;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb;">
      <div style="font-size:16px;font-weight:600;color:#1f2937;margin-bottom:16px;">Resumen ejecutivo</div>
      <table cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr>
          <td width="25%" style="padding:12px 14px;background:#f9fafb;border-radius:8px 0 0 8px;border-right:1px solid #e5e7eb;">
            <div style="font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;">Total backups</div>
            <div style="font-size:24px;font-weight:700;color:#1f2937;margin-top:4px;">${globalSummary.totalBackups}</div>
          </td>
          <td width="25%" style="padding:12px 14px;background:#f9fafb;border-right:1px solid #e5e7eb;">
            <div style="font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;">Volumen total</div>
            <div style="font-size:24px;font-weight:700;color:#1f2937;margin-top:4px;">${formatBytes(globalSummary.totalBytes)}</div>
          </td>
          <td width="25%" style="padding:12px 14px;background:#f9fafb;border-right:1px solid #e5e7eb;">
            <div style="font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;">Tasa de éxito</div>
            <div style="font-size:24px;font-weight:700;color:#10b981;margin-top:4px;">${globalSummary.successRate}%</div>
          </td>
          <td width="25%" style="padding:12px 14px;background:#f9fafb;border-radius:0 8px 8px 0;">
            <div style="font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;">Tasa de fallo</div>
            <div style="font-size:24px;font-weight:700;color:#ef4444;margin-top:4px;">${globalSummary.failureRate}%</div>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <tr>
    <td style="background:#ffffff;padding:0 32px 24px;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb;">
      ${renderProviderSection(aws)}
      ${renderProviderSection(huawei)}
    </td>
  </tr>

  <tr>
    <td style="background:#1e293b;padding:20px 32px;border-radius:0 0 12px 12px;text-align:center;">
      <div style="font-size:13px;color:#94a3b8;">UX Technology · MC Inventory</div>
      <div style="font-size:11px;color:#64748b;margin-top:4px;">Informe generado automáticamente · ${esc(dateLabel)}</div>
    </td>
  </tr>

</table>
</center>
</body>
</html>`;
}

export function generateEmailText(data: InformeData): string {
  const { aws, huawei, globalSummary, dateLabel } = data;

  const lines: string[] = [];
  lines.push("MC Inventory — Informe diario de backups");
  lines.push(dateLabel);
  lines.push("");
  lines.push("=== RESUMEN EJECUTIVO ===");
  lines.push(`Total backups: ${globalSummary.totalBackups}`);
  lines.push(`Volumen total: ${formatBytes(globalSummary.totalBytes)}`);
  lines.push(`Tasa de éxito: ${globalSummary.successRate}%`);
  lines.push(`Tasa de fallo: ${globalSummary.failureRate}%`);
  lines.push("");

  function renderProvider(report: ProviderReport) {
    lines.push(`=== ${report.provider.toUpperCase()} ===`);
    lines.push(`Backups: ${report.totalBackups} | Volumen: ${formatBytes(report.totalBytes)} | Éxito: ${report.successRate}% | Fallo: ${report.failureRate}%`);
    lines.push("");
    for (const acc of report.accounts) {
      const coverage = acc.totalServers ? Math.round((acc.serversWithBackup / acc.totalServers) * 100) : 0;
      lines.push(`-- ${acc.accountName} (${acc.accountId}) — ${acc.region} --`);
      lines.push(`  Total: ${acc.totalBackups} | Exitosos: ${acc.successfulBackups} | Fallidos: ${acc.failedBackups} | Cobertura: ${coverage}%`);
      lines.push("");
      for (const s of acc.servers) {
        const size = s.sizeBytes !== null ? formatBytes(s.sizeBytes) : "—";
        lines.push(`  ${s.resourceName} [${s.resourceType}]`);
        lines.push(`    Vault: ${s.vaultName} | Estado: ${s.status} | Fecha: ${formatDateShort(s.backupCreatedAt)} | Tamaño: ${size} | Expira: ${formatDateShort(s.backupExpiresAt)}`);
      }
      lines.push("");
    }
  }

  renderProvider(aws);
  renderProvider(huawei);

  lines.push("—");
  lines.push("UX Technology · MC Inventory");
  lines.push("Informe generado automáticamente");

  return lines.join("\n");
}
