/*
 Copyright 2016 Mozilla

 Licensed under the Apache License, Version 2.0 (the "License"); you may not use
 this file except in compliance with the License. You may obtain a copy of the
 License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software distributed
 under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
 CONDITIONS OF ANY KIND, either express or implied. See the License for the
 specific language governing permissions and limitations under the License.
 */

import * as profileActionTypes from '../constants/profile-action-types';

import Immutable from 'immutable';

export default function locationReducer(state = new Immutable.Map(), action) {
  const payload = action.payload;
  switch (action.type) {
    case profileActionTypes.DID_SET_COMPLETION_LIST_FOR:
      return state.set(payload.text, payload.completionList);

    default:
      return state;
  }
}