/*jshint node:true, indent:2, curly:true eqeqeq:true, immed:true, latedef:true, newcap:true, noarg:true,
regexp:true, undef:true, trailing:true, white:true */
/*global XT:true, XV:true, Globalize:true, enyo:true, _:true */

(function () {

  // ..........................................................
  // COST
  //

  enyo.kind({
    name: "XV.Cost",
    kind: "XV.Number",
    scale: XT.COST_SCALE
  });

  enyo.kind({
    name: "XV.CostWidget",
    kind: "XV.NumberWidget",
    scale: XT.COST_SCALE
  });

  // ..........................................................
  // EXTENDED PRICE
  //

  enyo.kind({
    name: "XV.ExtendedPrice",
    kind: "XV.Number",
    scale: XT.EXTENDED_PRICE_SCALE
  });

  enyo.kind({
    name: "XV.ExtendedPriceWidget",
    kind: "XV.NumberWidget",
    scale: XT.EXTENDED_PRICE_SCALE
  });

  // ..........................................................
  // MONEY
  //

  enyo.kind({
    kind: "XV.NumberWidget",
    name: "XV.MoneyWidget",
    classes: "xv-moneywidget",
    published: {
      scale: XT.MONEY_SCALE,
      localValue: null, // {Number} the number in the user field
      baseValue: null, // {Number} the amount in the base currency
      currency: null,
      effective: null,
      currencyDisabled: false,
      currencyShowing: true
    },
    handlers: {
      onValueChange: "valueChanged" // intercepts events from the picker or the field
    },
    components: [
      {kind: "FittableColumns", components: [
        {name: "label", content: "", classes: "xv-label"},
        {kind: "onyx.InputDecorator", classes: "xv-input-decorator",
          components: [
          {name: "input", kind: "onyx.Input", onchange: "inputChanged", onkeydown: "keyDown"}
        ]},
        {name: "picker", kind: "XV.CurrencyPicker",
          attr: "currency", showLabel: false}
      ]},
      {kind: "FittableColumns", name: "basePanel", showing: false,
        components: [
        {name: "spacer", content: "", classes: "xv-label"},
        {kind: "onyx.InputDecorator", classes: "xv-input-decorator",
          components: [
          {name: "baseAmountLabel", classes: "xv-money-label"}
        ]},
        {kind: "onyx.InputDecorator", classes: "xv-input-decorator",
          components: [
          {name: "baseCurrencyLabel", classes: "xv-money-label, currency"}
        ]}
      ]}
    ],
    /**
      If the effective date is provided, the fixedRate is set and the
      base panel is shown.
     */
    create: function () {
      this.inherited(arguments);
      this.setCurrency(XT.baseCurrency());
      this.$.picker.setValue(this.getCurrency(), {silent: true});
      this.$.baseCurrencyLabel.setContent(XT.baseCurrency().get('abbreviation'));
      // the currency picker may be disabled or hidden on creation in certain situations
      this.$.picker.setDisabled(this.getCurrencyDisabled());
      this.$.picker.setShowing(this.getCurrencyShowing());

      // this is for styling of the picker since the PickerWidget has a built in
      // input decorator
      this.$.picker.$.inputWrapper.removeClass("onyx-input-decorator");
    },

    effectiveChanged: function () {
      this.setBasePanelShowing();
      this.setLocal(this.getBaseValue());
    },

    /**
      Sets visibility of base panel. This panel is shown if there is an effective date and currency
        and the currency is not currently base.
     */
    setBasePanelShowing: function () {
      var showing = _.isDate(this.getEffective()) && this.getCurrency() && !this.getCurrency().get("isBase");
      this.$.basePanel.setShowing(showing);
    },

    /**
      Converts the local value to the base amount and sets this value in the model
     */
    setBase: function (input) {
      var options = {}, that = this;
      if (input || input === 0) {
        options.success = function (basePrice) {
          // set this base price into the model and published field
          //that.setValue(basePrice);
          that.setBaseValue(basePrice);
          // set this base price into the base amount label
          var amt = basePrice || basePrice === 0 ? Globalize.format(basePrice, "n" + that.getScale()) : "";
          that.$.baseAmountLabel.setContent(amt);
        };
        that.getCurrency().toBase(input, that.getEffective(), options);
      } else {
        that.setValue(null);
        that.setBaseValue(null);
      }
    },

    /**
      Converts the base value to the local value and sets this value in the widget
     */
    setLocal: function (input) {
      var options = {},
        that = this;

      if (this.getCurrency().get("isBase")) {
        // we're at base, so just set the fields with the base value we have
        this.setLocalValue(this.getBaseValue());
        this.$.input.setValue(this.getBaseValue());
      } else {
        if (input || input === 0) {
          options.success = function (localAmount) {
            // set this local amount into published and input fields
            that.setLocalValue(localAmount);
            that.$.input.setValue(localAmount);
          };
          options.error = function (err) {
            console.log("error");
          };
          that.getCurrency().fromBase(input, that.getEffective(), options);
        }
      }
    },

    /**
    If the effective date is available,
    calculate the base currency amount based on the fixed rate
    when the amount or currency are changed.
    inputChanged: function (inSender, inEvent) {
      // only show the base panel if there is an effective date AND the currency doesn't match the base
      // Set the model and the base label with calculated base value.
      this.setBasePanelShowing();
      var input = this.validate(this.$.input.getValue());
      this.setBase(input);
      this.setLocalValue(input);
    },
    */

    /**
    This setDisabled function is all or nothing for both widgets
    depending on value
    */
    setDisabled: function (isDisabled) {
      this.$.input.setDisabled(isDisabled);
      this.$.picker.setDisabled(this.currencyDisabled || isDisabled);
    },

    /**
      This setValue function handles a value which is an
      object consisting of two key/value pairs for the
      amount and currency controls. It will typically be called this
      way by the workspace, with silent:true, and in this case it
      has to appropriately propagate the values to the widgets.

      It can also handle just a number as the value, which it will assume
      to be the amount. The function will be called in this manner
      by the inputChanged function of the base class, and we need to
      have it work correctly in that context as well, mostly just repackaging
      the event as a valueChanged event.
    */
    setValue: function (value, options) {
      var oldValue,
        inEvent,
        amountAttr,
        fromUser = false,
        newValue;

      // support how this function is used by the base class.
      // assume if we get a number, that means the amount
      if (_.isNumber(value)) {
        fromUser = true;
        value = {amount: value};
      }

      options = options || {};
      for (var attribute in value) {
        if (value.hasOwnProperty(attribute)) {
          newValue = value[attribute];
          if (attribute === "amount") {
            if (fromUser) {
              this.setLocalValue(newValue);
            } else {
              // set the amount from the model, the base value in the published field
              this.setBaseValue(newValue);
              this.setLocal(newValue);
            }

            // the subwidget does not know its own attr, but we know what
            // it is because it's stored in our attr hash. substitute it.
            // that's all the workspace needs to know about the originator
            amountAttr = this.attr.amount;
            inEvent = { value: newValue, originator: {attr: amountAttr }};
            if (!options.silent) { this.doValueChange(inEvent); }
          } else if (attribute === "currency") {
            oldValue = this.getCurrency();
            if (newValue && oldValue !== newValue) {
              this.setCurrency(newValue);
              this.$.picker.setValue(this.getCurrency(), options);
            }
            // only show the base panel if there is an effective date AND the currency doesn't match the base
            // Set base label with calculated value
            this.setBasePanelShowing();
            this.setLocal(this.getBaseValue());
          }
          // set this base price into the base amount label
          var amt = this.getBaseValue() || this.getBaseValue() === 0 ? Globalize.format(this.getBaseValue(), "n" + this.getScale()) : "";
          this.$.baseAmountLabel.setContent(amt);
        }
      }
    },

    /**
      Intercept the valueChanged event and perform the following transformations:
      if the event is coming from the amount field, convert that local amount
      to the base amount.
      If the event is coming from the currency picker, add to it the base amount,
      which needs to be calculated.
     */
    valueChanged: function (inSender, inEvent) {
      console.log(inEvent && inEvent.originator && inEvent.originator.kind);
    }
  });

  // ..........................................................
  // PERCENT
  //

  enyo.kind({
    name: "XV.Percent",
    kind: "XV.Number",
    scale: XT.PERCENT_SCALE,
    validate: function (value) {
      return value && _.isNumber(value) ? value / 100 : null;
    },
    valueChanged: function (value) {
      value = !_.isNaN(value) ? value * 100 : value;
      XV.Number.prototype.valueChanged.call(this, value);
    }
  });

  enyo.kind({
    name: "XV.PercentWidget",
    kind: "XV.NumberWidget",
    scale: XT.PERCENT_SCALE,
    validate: function (value) {
      return value && !_.isNaN(value) ? value / 100 : null;
    },
    valueChanged: function (value) {
      value = !_.isNaN(value) ? value * 100 : value;
      XV.NumberWidget.prototype.valueChanged.call(this, value);
    }
  });

  // ..........................................................
  // PURCHASE PRICE
  //

  enyo.kind({
    name: "XV.PurchasePrice",
    kind: "XV.Number",
    scale: XT.PURCHASE_PRICE_SCALE
  });

  enyo.kind({
    name: "XV.PurchasePriceWidget",
    kind: "XV.NumberWidget",
    scale: XT.PURCHASE_PRICE_SCALE
  });

  // ..........................................................
  // QUANTITY
  //

  enyo.kind({
    name: "XV.Quantity",
    kind: "XV.Number",
    scale: XT.QTY_SCALE
  });

  enyo.kind({
    name: "XV.QuantityWidget",
    kind: "XV.NumberWidget",
    scale: XT.QTY_SCALE
  });

  // ..........................................................
  // QUANTITY PER
  //

  enyo.kind({
    name: "XV.QuantityPer",
    kind: "XV.Number",
    scale: XT.QTY_PER_SCALE
  });

  enyo.kind({
    name: "XV.QuantityPerWidget",
    kind: "XV.NumberWidget",
    scale: XT.QTY_PER_SCALE
  });

  // ..........................................................
  // SALES PRICE
  //

  enyo.kind({
    name: "XV.SalesPrice",
    kind: "XV.Number",
    scale: XT.SALES_PRICE_SCALE
  });

  enyo.kind({
    name: "XV.SalesPriceWidget",
    kind: "XV.NumberWidget",
    scale: XT.SALES_PRICE_SCALE
  });

  // ..........................................................
  // UNIT RATIO
  //

  enyo.kind({
    name: "XV.UnitRatio",
    kind: "XV.Number",
    scale: XT.UNIT_RATIO_SCALE
  });

  enyo.kind({
    name: "XV.UnitRatioWidget",
    kind: "XV.NumberWidget",
    scale: XT.UNIT_RATIO_SCALE
  });

  // ..........................................................
  // WEIGHT
  //

  enyo.kind({
    name: "XV.Weight",
    kind: "XV.Number",
    scale: XT.WEIGHT_SCALE
  });

  enyo.kind({
    name: "XV.WeightWidget",
    kind: "XV.NumberWidget",
    scale: XT.WEIGHT_SCALE
  });

}());
